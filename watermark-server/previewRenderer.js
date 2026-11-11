import sharp from "sharp";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PREVIEW_BUCKET = "resource-previews";
const SOURCE_BUCKET = "resources";

const WATERMARK_PATH = path.join(
  __dirname,
  "aneks-watermark.png",
);

const PAGE_DPI = 144;
const PAGE_BATCH_SIZE = 3;

const PREVIEW_WAIT_TIMEOUT_MS = 25000;
const PREVIEW_POLL_INTERVAL_MS = 500;

const MANIFEST_VERSION = 3;

const activeJobs = new Map();

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  );
}

function getBearerToken(req) {
  const authorization =
    req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeCategory(category) {
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }

  return category ?? null;
}

function getResourceExtension(resource) {
  const extension = path.extname(
    resource.file_path || resource.file_name || "",
  ).toLowerCase();

  if (extension) {
    return extension;
  }

  const mime = (resource.mime_type || "").toLowerCase();

  const mimeExtensions = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  return mimeExtensions[mime] ?? "";
}

function getMimeType(resource) {
  return (resource.mime_type || "").toLowerCase();
}

function isImageResource(resource) {
  return getMimeType(resource).startsWith("image/");
}

function isDocxResource(resource) {
  return (
    getMimeType(resource) ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    getResourceExtension(resource) === ".docx"
  );
}

function isPdfResource(resource) {
  return (
    getMimeType(resource) === "application/pdf" ||
    getResourceExtension(resource) === ".pdf"
  );
}

function isSupportedResource(resource) {
  return (
    isPdfResource(resource) ||
    isDocxResource(resource) ||
    [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(getMimeType(resource))
  );
}

function getPreviewPageExtension(resource) {
  return (
    getMimeType(resource) === "image/gif" ||
    getResourceExtension(resource) === ".gif"
  )
    ? "gif"
    : "png";
}

/*
 * Authorization
 */

function getContextAuthorization(
  context,
  role,
  subscriptionPlan,
  categoryName,
) {
  const isAdminOrCoAdmin = [
    "admin",
    "co-admin",
  ].includes(role);

  const canManageApprovals = [
    "admin",
    "co-admin",
    "staff",
    "lecturer",
  ].includes(role);

  const isExemptCategory = [
    "lecture timetables",
    "publications",
  ].includes(
    (categoryName || "").trim().toLowerCase(),
  );

  if (context === "academic") {
    return {
      allowed: role === "lecturer",
      restricted: false,
    };
  }

  if (context === "approvals") {
    return {
      allowed: canManageApprovals,
      restricted: false,
    };
  }

  if (context === "resources") {
    return {
      allowed: isAdminOrCoAdmin,
      restricted: false,
    };
  }

  if (context === "public") {
    return {
      allowed: true,
      restricted:
        !(
          isAdminOrCoAdmin ||
          subscriptionPlan === "premium" ||
          isExemptCategory
        ),
    };
  }

  return {
    allowed: false,
    restricted: true,
  };
}

async function authorizePreview(
  supabase,
  accessToken,
  resourceId,
  context,
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw createHttpError("Unauthorized.", 401);
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("private_profiles")
    .select(
      "primary_role, status, subscription_plan",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw createHttpError(
      "Unable to verify account authorization.",
      403,
    );
  }

  if (profile.status !== "active") {
    throw createHttpError(
      "Your account is not active.",
      403,
    );
  }

  const validContexts = [
    "public",
    "academic",
    "approvals",
    "resources",
  ];

  if (!validContexts.includes(context)) {
    throw createHttpError(
      "Invalid preview context.",
      400,
    );
  }

  const {
    data: resource,
    error: resourceError,
  } = await supabase
    .from("resources")
    .select(`
      id,
      file_path,
      file_name,
      mime_type,
      status,
      deleted_at,
      updated_at,
      category:categories (
        name,
        deleted_at
      )
    `)
    .eq("id", resourceId)
    .maybeSingle();

  if (resourceError || !resource) {
    throw createHttpError(
      "Resource not found.",
      404,
    );
  }

  // Always reject deleted records first.
  if (
    resource.deleted_at !== null ||
    resource.status === "deleted"
  ) {
    throw createHttpError(
      "This resource is not available for preview.",
      403,
    );
  }

  if (
    !["approved", "pending"].includes(
      resource.status,
    )
  ) {
    throw createHttpError(
      "This resource is not available for preview.",
      403,
    );
  }

  const category = normalizeCategory(
    resource.category,
  );

  const categoryName =
    category?.deleted_at == null
      ? category?.name?.trim() || ""
      : "";

  const contextAccess = getContextAuthorization(
    context,
    profile.primary_role,
    profile.subscription_plan,
    categoryName,
  );

  if (!contextAccess.allowed) {
    throw createHttpError(
      "You are not authorized to preview this resource.",
      403,
    );
  }

  if (resource.status === "pending") {
    const canPreviewPending = [
      "admin",
      "co-admin",
      "lecturer",
      "staff",
    ].includes(profile.primary_role);

    if (
      !canPreviewPending ||
      context === "public" ||
      context === "academic"
    ) {
      throw createHttpError(
        "This resource is not available for preview.",
        403,
      );
    }
  }

  if (!isSupportedResource(resource)) {
    throw createHttpError(
      "This file type is not supported for secure preview.",
      415,
    );
  }

  if (!resource.file_path) {
    throw createHttpError(
      "The original resource file is unavailable.",
      404,
    );
  }

  return {
    user,
    profile,
    resource,
    restricted: contextAccess.restricted,
  };
}

/*
 * Watermark and restriction overlays
 */

async function createWatermarkOverlay(
  width,
  height,
) {
  const targetWidth = Math.max(
    1,
    Math.round(width * 0.85),
  );

  let watermark = await sharp(WATERMARK_PATH)
    .resize({
      width: targetWidth,
      fit: "inside",
    })
    .rotate(-55, {
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .png()
    .toBuffer();

  let metadata = await sharp(watermark).metadata();

  if (
    (metadata.width ?? 0) > width ||
    (metadata.height ?? 0) > height
  ) {
    watermark = await sharp(watermark)
      .resize({
        width: Math.max(1, width - 2),
        height: Math.max(1, height - 2),
        fit: "inside",
      })
      .png()
      .toBuffer();

    metadata = await sharp(watermark).metadata();
  }

  const left = Math.max(
    0,
    Math.round(
      (width - (metadata.width ?? width)) / 2,
    ),
  );

  const top = Math.max(
    0,
    Math.round(
      (height - (metadata.height ?? height)) / 2,
    ),
  );

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: watermark,
        left,
        top,
      },
    ])
    .png()
    .toBuffer();
}

async function createRestrictionOverlay(
  width,
  height,
) {
  const svg = Buffer.from(`
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="${Math.floor(width / 2)}"
        y="0"
        width="${Math.ceil(width / 2)}"
        height="${height}"
        fill="#f5f5f5"
      />
    </svg>
  `);

  return sharp(svg).png().toBuffer();
}

async function processPage(
  inputPath,
  outputPath,
  restricted,
) {
  const input = await readFile(inputPath);

  const metadata = await sharp(input).metadata();

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error(
      "Unable to determine rendered page dimensions.",
    );
  }

  const overlays = [];

  if (restricted) {
    /*
     * Blur the complete source first, then extract
     * only the right half.
     *
     * This avoids an artificial blur boundary at
     * the centre of the page.
     */
    const blurredPage = await sharp(input)
      .blur(40)
      .png()
      .toBuffer();

    const midpoint = Math.floor(width / 2);
    const rightWidth = width - midpoint;

    const blurredRightHalf = await sharp(blurredPage)
      .extract({
        left: midpoint,
        top: 0,
        width: rightWidth,
        height,
      })
      .png()
      .toBuffer();

    overlays.push({
      input: blurredRightHalf,
      left: midpoint,
      top: 0,
    });
  }

  /*
   * Apply the watermark after the blur so that
   * it remains visible across both halves.
   */
  const watermarkOverlay =
    await createWatermarkOverlay(width, height);

  overlays.push({
    input: watermarkOverlay,
    left: 0,
    top: 0,
  });

  await sharp(input)
    .composite(overlays)
    .png()
    .toFile(outputPath);
}

/*
 * PDF and DOCX conversion
 */

async function getPdfPageCount(pdfPath) {
  const { stdout } = await execFileAsync(
    "pdfinfo",
    [pdfPath],
    {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    },
  );

  const match = stdout.match(
    /^Pages:\s+(\d+)/m,
  );

  if (!match) {
    throw new Error(
      "Unable to determine PDF page count.",
    );
  }

  const pageCount = Number(match[1]);

  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1
  ) {
    throw new Error(
      "The document contains no renderable pages.",
    );
  }

  return pageCount;
}

async function convertDocxToPdf(
  docxPath,
  tempDirectory,
) {
  const profileDirectory = path.join(
    tempDirectory,
    "libreoffice-profile",
  );

  const profileUrl =
    `file://${profileDirectory.replace(/\\/g, "/")}`;

  await execFileAsync(
    "libreoffice",
    [
      "--headless",
      `-env:UserInstallation=${profileUrl}`,
      "--convert-to",
      "pdf",
      "--outdir",
      tempDirectory,
      docxPath,
    ],
    {
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024,
    },
  );

  const pdfPath = path.join(
    tempDirectory,
    `${path.basename(docxPath, path.extname(docxPath))}.pdf`,
  );

  return pdfPath;
}

async function renderPdfPage(
  pdfPath,
  tempDirectory,
  pageNumber,
  restricted,
  uploadPage,
) {
  const prefix = path.join(
    tempDirectory,
    `source-page-${pageNumber}`,
  );

  await execFileAsync(
    "pdftoppm",
    [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-png",
      "-r",
      String(PAGE_DPI),
      "-singlefile",
      pdfPath,
      prefix,
    ],
    {
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024,
    },
  );

  const sourcePage = `${prefix}.png`;

  const processedPage = path.join(
    tempDirectory,
    `processed-page-${pageNumber}.png`,
  );

  await processPage(
    sourcePage,
    processedPage,
    restricted,
  );

  await uploadPage(
    pageNumber,
    processedPage,
    "image/png",
  );
}

/*
 * Image conversion
 */

async function getImagePageCount(sourceBuffer) {
  const metadata = await sharp(
    sourceBuffer,
    { animated: true },
  ).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(
      "Unable to determine image dimensions.",
    );
  }

  return 1;
}

async function renderImage(
  sourceBuffer,
  tempDirectory,
  restricted,
  uploadPage,
) {
  const metadata = await sharp(
    sourceBuffer,
    { animated: true },
  ).metadata();

  const isGif = metadata.format === "gif";

  if (isGif) {
    const width = metadata.width;
    const height = metadata.pageHeight ?? metadata.height;

    if (!width || !height) {
      throw new Error(
        "Unable to determine image dimensions.",
      );
    }

    const watermarkOverlay =
      await createWatermarkOverlay(width, height);

    const overlays = [
      {
        input: watermarkOverlay,
        left: 0,
        top: 0,
        tile: true,
      },
    ];

    if (restricted) {
      overlays.push({
        input: await createRestrictionOverlay(
          width,
          height,
        ),
        left: 0,
        top: 0,
        tile: true,
      });
    }

    const outputPath = path.join(
      tempDirectory,
      "processed-image.gif",
    );

    await sharp(sourceBuffer, {
      animated: true,
    })
      .composite(overlays)
      .gif({
        loop: metadata.loop ?? 0,
        delay: metadata.delay,
      })
      .toFile(outputPath);

    await uploadPage(
      1,
      outputPath,
      "image/gif",
    );

    return 1;
  }

  // Rotate once and reuse the resulting image.
  const rotatedImage = await sharp(sourceBuffer)
    .rotate()
    .png()
    .toBuffer();

  const rotatedMetadata =
    await sharp(rotatedImage).metadata();

  const width = rotatedMetadata.width;
  const height = rotatedMetadata.height;

  if (!width || !height) {
    throw new Error(
      "Unable to determine rotated image dimensions.",
    );
  }

  const overlays = [];

  if (restricted) {
    // Blur the complete image before extracting
    // the right half to avoid a visible blur boundary.
    const blurredImage = await sharp(rotatedImage)
      .blur(40)
      .png()
      .toBuffer();

    const midpoint = Math.floor(width / 2);
    const rightWidth = width - midpoint;

    const blurredRightHalf = await sharp(blurredImage)
      .extract({
        left: midpoint,
        top: 0,
        width: rightWidth,
        height,
      })
      .png()
      .toBuffer();

    overlays.push({
      input: blurredRightHalf,
      left: midpoint,
      top: 0,
    });
  }

  // Apply watermark after the blur so it remains
  // visible across the entire image.
  const watermarkOverlay =
    await createWatermarkOverlay(width, height);

  overlays.push({
    input: watermarkOverlay,
    left: 0,
    top: 0,
  });

  const outputPath = path.join(
    tempDirectory,
    "processed-image.png",
  );

  await sharp(rotatedImage)
    .composite(overlays)
    .png()
    .toFile(outputPath);

  await uploadPage(
    1,
    outputPath,
    "image/png",
  );

  return 1;
}

/*
 * Preview storage and manifest helpers
 */

function getPageObjectName(
  pageNumber,
  extension,
) {
  return `page-${String(pageNumber).padStart(6, "0")}.${extension}`;
}

function getPageObjectPath(
  folder,
  pageNumber,
  extension,
) {
  return `${folder}/${getPageObjectName(
    pageNumber,
    extension,
  )}`;
}

function getManifestPath(folder) {
  return `${folder}/_manifest.json`;
}

async function listCachedPages(
  supabase,
  folder,
) {
  const pages = [];
  let offset = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .list(folder, {
        limit: 1000,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    pages.push(
      ...data
        .filter((item) =>
          /^page-\d{6}\.(png|gif)$/.test(item.name),
        )
        .map((item) => item.name),
    );

    if (data.length < 1000) {
      break;
    }

    offset += data.length;
  }

  return pages.sort();
}

async function readPreviewManifest(
  supabase,
  folder,
) {
  const {
    data,
    error,
  } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .download(getManifestPath(folder));

  if (error) {
    const isMissing =
      error.statusCode === "404" ||
      /not found/i.test(error.message || "");

    if (isMissing) {
      return null;
    }

    throw error;
  }

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function writePreviewManifest(
  supabase,
  folder,
  manifest,
) {
  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(
      getManifestPath(folder),
      Buffer.from(
        JSON.stringify(manifest),
        "utf8",
      ),
      {
        contentType: "application/json",
        upsert: true,
        cacheControl: "0",
      },
    );

  if (error) {
    throw error;
  }
}

function getExpectedPageNames(
  pageCount,
  extension,
) {
  return Array.from(
    { length: pageCount },
    (_, index) =>
      getPageObjectName(index + 1, extension),
  );
}

function getCompletedPageNumbers(
  cachedPageNames,
  pageCount,
  extension,
) {
  const cachedNames = new Set(cachedPageNames);

  const completed = [];

  for (
    let pageNumber = 1;
    pageNumber <= pageCount;
    pageNumber++
  ) {
    const expectedName = getPageObjectName(
      pageNumber,
      extension,
    );

    if (cachedNames.has(expectedName)) {
      completed.push(pageNumber);
    }
  }

  return completed;
}

async function isCompletedPreviewCache(
  supabase,
  folder,
  sourceVersion,
  variant,
) {
  const manifest = await readPreviewManifest(
    supabase,
    folder,
  );

  if (
    !manifest ||
    manifest.version !== MANIFEST_VERSION ||
    manifest.sourceVersion !== sourceVersion ||
    manifest.variant !== variant ||
    manifest.status !== "completed" ||
    !Number.isInteger(manifest.pageCount) ||
    manifest.pageCount < 1 ||
    !["png", "gif"].includes(manifest.pageExtension)
  ) {
    return null;
  }

  const cachedPages = await listCachedPages(
    supabase,
    folder,
  );

  const expectedPages = getExpectedPageNames(
    manifest.pageCount,
    manifest.pageExtension,
  );

  const cacheIsComplete =
    cachedPages.length === manifest.pageCount &&
    expectedPages.every(
      (name, index) => cachedPages[index] === name,
    );

  if (!cacheIsComplete) {
    return null;
  }

  return manifest;
}

async function removeUnexpectedCachedPages(
  supabase,
  folder,
  pageCount,
  extension,
) {
  const cachedPages = await listCachedPages(
    supabase,
    folder,
  );

  const expectedNames = new Set(
    getExpectedPageNames(pageCount, extension),
  );

  const unexpectedNames = cachedPages.filter(
    (name) => !expectedNames.has(name),
  );

  if (!unexpectedNames.length) {
    return;
  }

  const objectPaths = unexpectedNames.map(
    (name) => `${folder}/${name}`,
  );

  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .remove(objectPaths);

  if (error) {
    throw error;
  }
}

/*
 * Progressive rendering worker
 *
 * Each page is uploaded before its page number is
 * added to the persisted manifest.
 *
 * A later Render instance can therefore determine
 * which pages are already complete and resume safely.
 */

async function runRenderJob({
  supabase,
  resource,
  restricted,
  folder,
  sourceVersion,
  variant,
}) {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "aneks-preview-"),
  );

  let manifest = null;

  try {
    const {
      data: sourceBlob,
      error: downloadError,
    } = await supabase.storage
      .from(SOURCE_BUCKET)
      .download(resource.file_path);

    if (downloadError || !sourceBlob) {
      throw new Error(
        "Unable to retrieve the original resource.",
      );
    }

    const sourceBuffer = Buffer.from(
      await sourceBlob.arrayBuffer(),
    );

    const extension =
      getResourceExtension(resource);

    const sourcePath = path.join(
      tempDirectory,
      `source${extension}`,
    );

    await writeFile(sourcePath, sourceBuffer);

    let pdfPath = sourcePath;
    let pageCount;
    let pageExtension =
      getPreviewPageExtension(resource);

    if (isImageResource(resource)) {
      pageCount = await getImagePageCount(
        sourceBuffer,
      );
    } else {
      if (isDocxResource(resource)) {
        pdfPath = await convertDocxToPdf(
          sourcePath,
          tempDirectory,
        );
      }

      pageCount = await getPdfPageCount(pdfPath);
    }

    const cachedPageNames = await listCachedPages(
      supabase,
      folder,
    );

    const completedPages = new Set(
      getCompletedPageNumbers(
        cachedPageNames,
        pageCount,
        pageExtension,
      ),
    );

    manifest = {
      version: MANIFEST_VERSION,
      resourceId: resource.id,
      sourceVersion,
      variant,
      status: "rendering",
      pageCount,
      pageExtension,
      completedPages: [...completedPages].sort(
        (a, b) => a - b,
      ),
      pages: getExpectedPageNames(
        pageCount,
        pageExtension,
      ).map((name) => `${folder}/${name}`),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    await writePreviewManifest(
      supabase,
      folder,
      manifest,
    );

    const uploadPage = async (
      pageNumber,
      filePath,
      contentType,
    ) => {
      const pageBuffer = await readFile(filePath);

      const outputExtension =
        contentType === "image/gif"
          ? "gif"
          : "png";

      if (outputExtension !== pageExtension) {
        throw new Error(
          "Rendered page format does not match the preview manifest.",
        );
      }

      const objectPath = getPageObjectPath(
        folder,
        pageNumber,
        outputExtension,
      );

      const { error } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .upload(objectPath, pageBuffer, {
          contentType,
          upsert: true,
          cacheControl: "3600",
        });

      if (error) {
        throw error;
      }

      /*
       * The storage upload must succeed before
       * the page is recorded as completed.
       */
      completedPages.add(pageNumber);

      manifest.completedPages = [
        ...completedPages,
      ].sort((a, b) => a - b);

      manifest.status =
        completedPages.size === pageCount
          ? "completed"
          : "rendering";

      manifest.updatedAt =
        new Date().toISOString();

      if (manifest.status === "completed") {
        manifest.completedAt =
          new Date().toISOString();
      }

      await writePreviewManifest(
        supabase,
        folder,
        manifest,
      );
    };

    if (isImageResource(resource)) {
      if (!completedPages.has(1)) {
        await renderImage(
          sourceBuffer,
          tempDirectory,
          restricted,
          uploadPage,
        );
      }
    } else {
      /*
       * Resume from the first missing page.
       * Already uploaded pages are not rendered again.
       */
      for (
        let pageNumber = 1;
        pageNumber <= pageCount;
        pageNumber++
      ) {
        if (completedPages.has(pageNumber)) {
          continue;
        }

        await renderPdfPage(
          pdfPath,
          tempDirectory,
          pageNumber,
          restricted,
          uploadPage,
        );
      }
    }

    if (completedPages.size !== pageCount) {
      throw new Error(
        "Preview generation did not produce every expected page.",
      );
    }

    await removeUnexpectedCachedPages(
      supabase,
      folder,
      pageCount,
      pageExtension,
    );

    manifest.status = "completed";
    manifest.completedPages = [
      ...completedPages,
    ].sort((a, b) => a - b);

    manifest.updatedAt =
      new Date().toISOString();

    manifest.completedAt =
      manifest.completedAt ||
      new Date().toISOString();

    await writePreviewManifest(
      supabase,
      folder,
      manifest,
    );

    return manifest;
  } catch (error) {
    if (manifest) {
      try {
        manifest.status = "failed";
        manifest.updatedAt =
          new Date().toISOString();

        /*
         * Do not store internal exception details
         * in the public preview manifest.
         */
        await writePreviewManifest(
          supabase,
          folder,
          manifest,
        );
      } catch (manifestError) {
        console.error(
          "Unable to persist failed preview state:",
          manifestError,
        );
      }
    }

    throw error;
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

/*
 * Background job coordination
 *
 * The map prevents duplicate jobs within the same
 * running Render process.
 *
 * Persisted manifests and uploaded page objects
 * provide recovery after a process restart.
 */

function ensureRenderJob({
  cacheKey,
  supabase,
  resource,
  restricted,
  folder,
  sourceVersion,
  variant,
}) {
  const existingJob = activeJobs.get(cacheKey);

  if (existingJob) {
    return existingJob;
  }

  const job = runRenderJob({
    supabase,
    resource,
    restricted,
    folder,
    sourceVersion,
    variant,
  });

  activeJobs.set(cacheKey, job);

  /*
   * Attach both completion handlers so background
   * failures do not become unhandled rejections.
   */
  job.then(
    () => {
      if (activeJobs.get(cacheKey) === job) {
        activeJobs.delete(cacheKey);
      }
    },
    (error) => {
      console.error(
        "Background preview rendering failed:",
        error,
      );

      if (activeJobs.get(cacheKey) === job) {
        activeJobs.delete(cacheKey);
      }
    },
  );

  return job;
}

/*
 * Wait only for the requested pages.
 *
 * The renderer does not wait for the entire document
 * when the caller only needs the first three pages.
 */

async function waitForRequestedPages({
  supabase,
  folder,
  sourceVersion,
  variant,
  pageFrom,
  requestedPageCount,
}) {
  const deadline =
    Date.now() + PREVIEW_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const manifest = await readPreviewManifest(
      supabase,
      folder,
    );

    if (manifest) {
      if (
        manifest.version !== MANIFEST_VERSION ||
        manifest.sourceVersion !== sourceVersion ||
        manifest.variant !== variant ||
        !Number.isInteger(manifest.pageCount) ||
        manifest.pageCount < 1 ||
        !["png", "gif"].includes(manifest.pageExtension) ||
        !["rendering", "completed", "failed"].includes(
          manifest.status,
        )
      ) {
        throw createHttpError(
          "The preview cache is invalid.",
          500,
        );
      }

      if (pageFrom >= manifest.pageCount) {
        throw createHttpError(
          "The requested page is outside this document.",
          416,
        );
      }

      const endPage = Math.min(
        pageFrom + requestedPageCount,
        manifest.pageCount,
      );

      const completedPages = new Set(
        Array.isArray(manifest.completedPages)
          ? manifest.completedPages
          : [],
      );

      /*
       * Determine the contiguous sequence of ready pages.
       *
       * We cannot skip a missing page because the browser
       * expects sequential pagination.
       */
      const readyPages = [];

      for (
        let pageNumber = pageFrom + 1;
        pageNumber <= endPage;
        pageNumber++
      ) {
        if (!completedPages.has(pageNumber)) {
          break;
        }

        readyPages.push(
          getPageObjectPath(
            folder,
            pageNumber,
            manifest.pageExtension,
          ),
        );
      }

      const requestedPagesReady =
        readyPages.length === endPage - pageFrom;

      /*
       * Normally, wait for the complete requested batch.
       *
       * If rendering has failed, return any contiguous
       * pages already completed instead of blocking them.
       * A subsequent request can restart the failed job.
       */
      if (
        requestedPagesReady ||
        (
          manifest.status === "failed" &&
          readyPages.length > 0
        )
      ) {
        const nextPageFrom =
          pageFrom + readyPages.length;

        return {
          pageCount: manifest.pageCount,
          pageFrom,
          pages: readyPages,
          variant,
          hasMore:
            nextPageFrom < manifest.pageCount,
          nextPageFrom:
            nextPageFrom < manifest.pageCount
              ? nextPageFrom
              : null,
          renderingStatus: manifest.status,
        };
      }

      /*
       * No usable pages remain for this request after
       * a failed rendering attempt.
       */
      if (manifest.status === "failed") {
        throw createHttpError(
          "Preview generation was interrupted. Please retry.",
          503,
        );
      }
    }

    await sleep(PREVIEW_POLL_INTERVAL_MS);
  }

  /*
   * The requested batch is not ready yet.
   * The client can retry after the supplied delay.
   */
  throw createHttpError(
    "The requested preview pages are still being prepared. Please retry shortly.",
    202,
  );
}

/*
 * Main preview renderer
 */

export function createPreviewRenderer({
  app,
  supabase,
  watermarkSecret,
}) {
  app.post(
    "/preview/prepare",
    async (req, res) => {
      try {
        const suppliedSecret =
          req.headers["x-watermark-secret"];

        if (
          typeof suppliedSecret !== "string" ||
          suppliedSecret !== watermarkSecret
        ) {
          return res.status(401).json({
            error: "Unauthorized.",
          });
        }

        const accessToken = getBearerToken(req);

        if (!accessToken) {
          return res.status(401).json({
            error: "Missing user authorization.",
          });
        }

        const {
          resourceId,
          context,
        } = req.body ?? {};

        if (
          typeof resourceId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            resourceId,
          )
        ) {
          return res.status(400).json({
            error: "Invalid resourceId.",
          });
        }

        const pageFrom =
          req.body?.pageFrom === undefined
            ? 0
            : req.body.pageFrom;

        if (
          !Number.isInteger(pageFrom) ||
          pageFrom < 0
        ) {
          return res.status(400).json({
            error: "Invalid pageFrom value.",
          });
        }

        const requestedPageCount =
          req.body?.pageCount === undefined
            ? PAGE_BATCH_SIZE
            : req.body.pageCount;

        if (
          !Number.isInteger(requestedPageCount) ||
          requestedPageCount < 1
        ) {
          return res.status(400).json({
            error: "Invalid pageCount value.",
          });
        }

        const pageCount = Math.min(
          requestedPageCount,
          PAGE_BATCH_SIZE,
        );

        const authorization =
          await authorizePreview(
            supabase,
            accessToken,
            resourceId,
            context,
          );

        const resource = authorization.resource;
        const restricted = authorization.restricted;

        const sourceVersion = sha256(
          [
            resource.id,
            resource.file_path,
            resource.updated_at ?? "",
            resource.mime_type ?? "",
          ].join("|"),
        );

        const variant = restricted
          ? "restricted"
          : "full";

        const folder = [
          resource.id,
          sourceVersion,
          variant,
        ].join("/");

        const cacheKey = sha256(
          [
            resource.id,
            sourceVersion,
            variant,
          ].join("|"),
        );

        /*
         * Reuse an already completed preview without
         * starting another rendering job.
         */
        const completedCache =
          await isCompletedPreviewCache(
            supabase,
            folder,
            sourceVersion,
            variant,
          );

        if (!completedCache) {
          ensureRenderJob({
            cacheKey,
            supabase,
            resource,
            restricted,
            folder,
            sourceVersion,
            variant,
          });
        }

        const result =
          await waitForRequestedPages({
            supabase,
            folder,
            sourceVersion,
            variant,
            pageFrom,
            requestedPageCount: pageCount,
          });

        res.setHeader(
          "Cache-Control",
          "private, no-store",
        );

        return res.status(200).json({
          resourceId: resource.id,
          pageCount: result.pageCount,
          pageFrom: result.pageFrom,
          variant: result.variant,
          pages: result.pages,
          nextPageFrom: result.nextPageFrom,
          hasMore: result.hasMore,
          renderingStatus: result.renderingStatus,
        });
      } catch (error) {
        console.error(
          "Secure preview preparation failed:",
          error,
        );

        if (error.status === 202) {
          res.setHeader(
            "Retry-After",
            "1",
          );

          return res.status(202).json({
            error: error.message,
            status: "processing",
            retryAfterMs: 1000,
          });
        }

        const status =
          Number.isInteger(error.status) &&
          error.status >= 400 &&
          error.status <= 599
            ? error.status
            : 500;

        const safeMessage =
          status >= 500
            ? "Unable to prepare this preview. Please retry."
            : error.message;

        return res.status(status).json({
          error: safeMessage,
        });
      }
    },
  );
}