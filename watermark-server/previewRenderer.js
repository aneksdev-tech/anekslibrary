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
const FREE_PREVIEW_PAGE_LIMIT = 3;

const FREE_PREVIEW_EXEMPT_CATEGORIES = new Set([
  "publications",
  "lecture-timetables",
]);

const PREVIEW_WAIT_TIMEOUT_MS = 25000;
const PREVIEW_POLL_INTERVAL_MS = 500;

const MANIFEST_VERSION = 12;

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
  isPremium,
  categorySlug,
) {
  const isPrivileged = [
    "admin",
    "co-admin",
  ].includes(role);

  const isExemptCategory =
    FREE_PREVIEW_EXEMPT_CATEGORIES.has(
      categorySlug,
    );

  switch (context) {
    case "academic":
      return {
        allowed: role === "lecturer",
        freeLimited: false,
      };

    case "approvals":
      return {
        allowed: [
          "admin",
          "co-admin",
          "staff",
          "lecturer",
        ].includes(role),
        freeLimited: false,
      };

    case "resources":
      return {
        allowed: isPrivileged,
        freeLimited: false,
      };

    case "public":
      return {
        allowed: true,
        freeLimited:
          !isPrivileged &&
          !isPremium &&
          !isExemptCategory,
      };

    default:
      return {
        allowed: false,
        freeLimited: false,
      };
  }
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
    .select("primary_role, status")
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

const {
  data: premiumData,
  error: premiumError,
} = await supabase.rpc("is_premium", {
  _user: user.id,
});

const isPremium =
  !premiumError && premiumData === true;

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
      categories!resources_category_id_fkey (
        slug
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

const categoryRelation = resource.categories;

const categorySlug = Array.isArray(categoryRelation)
  ? categoryRelation[0]?.slug ?? null
  : categoryRelation?.slug ?? null;

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

  const contextAccess = getContextAuthorization(
  context,
  profile.primary_role,
  isPremium,
  categorySlug,
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
    context === "public"
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
    freeLimited: contextAccess.freeLimited,
  };
}

/*
 * Watermark and restriction overlays
 */

async function createWatermarkOverlay(
  width,
  height,
) {
  // Read the watermark's alpha channel.
  const {
    data,
    info,
  } = await sharp(WATERMARK_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  // Find the actual visible watermark boundaries.
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[
        (y * info.width + x) * 4 + 3
      ];

      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(
      "Watermark image contains no visible pixels.",
    );
  }

  const visibleWidth = maxX - minX + 1;
  const visibleHeight = maxY - minY + 1;

  const targetWidth = Math.max(
    1,
    Math.round(width * 0.50),
  );

  // Extract only the visible watermark before resizing.
  let watermark = await sharp(WATERMARK_PATH)
    .extract({
      left: minX,
      top: minY,
      width: visibleWidth,
      height: visibleHeight,
    })
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

// Reduce the existing watermark alpha to 25%.
// Preserve the original RGB values and transparent background.
const {
  data: watermarkData,
  info: watermarkInfo,
} = await sharp(watermark)
  .ensureAlpha()
  .raw()
  .toBuffer({
    resolveWithObject: true,
  });

for (
  let i = 3;
  i < watermarkData.length;
  i += 4
) {
  watermarkData[i] = Math.round(
    watermarkData[i] * 0.25,
  );
}

watermark = await sharp(watermarkData, {
  raw: {
    width: watermarkInfo.width,
    height: watermarkInfo.height,
    channels: 4,
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

async function processPage(
  inputPath,
  outputPath,
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

  const watermarkOverlay =
    await createWatermarkOverlay(width, height);

  await sharp(input)
    .composite([
      {
        input: watermarkOverlay,
        left: 0,
        top: 0,
      },
    ])
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

    const outputPath = path.join(
      tempDirectory,
      "processed-image.gif",
    );

    await sharp(sourceBuffer, {
      animated: true,
    })
      .composite([
        {
          input: watermarkOverlay,
          left: 0,
          top: 0,
          tile: true,
        },
      ])
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

  const watermarkOverlay =
    await createWatermarkOverlay(width, height);

  const outputPath = path.join(
    tempDirectory,
    "processed-image.png",
  );

  await sharp(rotatedImage)
    .composite([
      {
        input: watermarkOverlay,
        left: 0,
        top: 0,
      },
    ])
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

function isValidManifest({
  manifest,
  resourceId,
  sourceVersion,
  variant,
}) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    return false;
  }

  if (
    manifest.version !== MANIFEST_VERSION ||
    manifest.resourceId !== resourceId ||
    manifest.sourceVersion !== sourceVersion ||
    manifest.variant !== variant
  ) {
    return false;
  }

  if (
    !Number.isInteger(manifest.pageCount) ||
    manifest.pageCount < 1 ||
    !Number.isInteger(manifest.renderPageCount) ||
    manifest.renderPageCount < 1 ||
    manifest.renderPageCount > manifest.pageCount
  ) {
    return false;
  }

  if (
    variant === "free" &&
    manifest.renderPageCount >
      FREE_PREVIEW_PAGE_LIMIT
  ) {
    return false;
  }

  if (
    !["png", "gif"].includes(
      manifest.pageExtension,
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(manifest.completedPages) ||
    !Array.isArray(manifest.pages)
  ) {
    return false;
  }

const expectedPages = getExpectedPageNames(
  manifest.renderPageCount,
  manifest.pageExtension,
).map(
  (name) => `${resourceId}/${sourceVersion}/${variant}/${name}`,
);

if (
  manifest.pages.length !== expectedPages.length ||
  manifest.pages.some(
    (page, index) =>
      page !== expectedPages[index],
  )
) {
  return false;
}

  const completedPages = manifest.completedPages;

  if (
    completedPages.some(
      (page) =>
        !Number.isInteger(page) ||
        page < 1 ||
        page > manifest.renderPageCount,
    ) ||
    new Set(completedPages).size !== completedPages.length
  ) {
    return false;
  }

  if (
    manifest.status === "completed" &&
    completedPages.length !== manifest.renderPageCount
  ) {
    return false;
  }

  if (
    !["rendering", "completed", "failed"].includes(
      manifest.status,
    )
  ) {
    return false;
  }

  return true;
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
  renderPageCount,
  extension,
) {
  const cachedNames = new Set(cachedPageNames);

  const completed = [];

  for (
    let pageNumber = 1;
    pageNumber <= renderPageCount;
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
  resourceId,
) {
  const manifest = await readPreviewManifest(
    supabase,
    folder,
  );

  if (
    !isValidManifest({
      manifest,
      resourceId,
      sourceVersion,
      variant,
    }) ||
    manifest.status !== "completed"
  ) {
    return null;
  }

  const cachedPages = await listCachedPages(
    supabase,
    folder,
  );

  const expectedPages = getExpectedPageNames(
    manifest.renderPageCount,
    manifest.pageExtension,
  );

  const cacheIsComplete =
    cachedPages.length === manifest.renderPageCount &&
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
  renderPageCount,
  extension,
) {
  const cachedPages = await listCachedPages(
    supabase,
    folder,
  );

  const expectedNames = new Set(
    getExpectedPageNames(
      renderPageCount,
      extension,
    ),
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
  freeLimited,
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

  const renderPageCount = freeLimited
  ? Math.min(
      pageCount,
      FREE_PREVIEW_PAGE_LIMIT,
    )
  : pageCount;

const previousManifest = await readPreviewManifest(
  supabase,
  folder,
);

const canResumeCachedPages =
  isValidManifest({
    manifest: previousManifest,
    resourceId: resource.id,
    sourceVersion,
    variant,
  }) &&
  previousManifest.pageCount === pageCount &&
  previousManifest.renderPageCount === renderPageCount &&
  previousManifest.pageExtension === pageExtension;

const cachedPageNames = canResumeCachedPages
  ? await listCachedPages(supabase, folder)
  : [];

const completedPages = new Set(
  getCompletedPageNumbers(
    cachedPageNames,
    renderPageCount,
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
   renderPageCount,
   pageExtension,
   completedPages: [...completedPages].sort(
    (a, b) => a - b,
  ),
  pages: getExpectedPageNames(
    renderPageCount,
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
        completedPages.size === renderPageCount
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
        pageNumber <= renderPageCount;
        pageNumber++
      ) {
        if (completedPages.has(pageNumber)) {
          continue;
        }

        await renderPdfPage(
          pdfPath,
          tempDirectory,
          pageNumber,
          uploadPage,
        );
      }
    }

    if (completedPages.size !== renderPageCount) {
      throw new Error(
        "Preview generation did not produce every expected page.",
      );
    }

    await removeUnexpectedCachedPages(
      supabase,
      folder,
      renderPageCount,
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
  freeLimited,
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
    freeLimited,
    folder,
    sourceVersion,
    variant,
  });

  activeJobs.set(cacheKey, job);

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
  resourceId,
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
        !isValidManifest({
          manifest,
          resourceId,
          sourceVersion,
          variant,
        })
      ) {
        await sleep(PREVIEW_POLL_INTERVAL_MS);
        continue;
      }

      if (pageFrom >= manifest.pageCount) {
        throw createHttpError(
          "The requested page is outside this document.",
          416,
        );
      }

      const upgradeRequired =
        manifest.pageCount > manifest.renderPageCount;

      /*
       * Free users requesting page 4 or later receive
       * upgrade metadata, never a derivative page path.
       */
      if (pageFrom >= manifest.renderPageCount) {
        if (!upgradeRequired) {
          throw createHttpError(
            "The requested page is outside this document.",
            416,
          );
        }

        return {
          pageCount: manifest.pageCount,
          renderedPageCount: manifest.renderPageCount,
          pageFrom,
          pages: [],
          variant,
          hasMore: false,
          nextPageFrom: null,
          upgradeRequired: true,
          upgradePage: FREE_PREVIEW_PAGE_LIMIT + 1,
          renderingStatus: manifest.status,
        };
      }

      const endPage = Math.min(
        pageFrom + requestedPageCount,
        manifest.renderPageCount,
      );

      const completedPages = new Set(
        manifest.completedPages,
      );

      /*
       * Check actual Storage objects as well as
       * the manifest's completed-page records.
       */
      const cachedPageNames = await listCachedPages(
        supabase,
        folder,
      );

      const cachedPageSet = new Set(cachedPageNames);

      const readyPages = [];

      for (
        let pageNumber = pageFrom + 1;
        pageNumber <= endPage;
        pageNumber++
      ) {
        if (!completedPages.has(pageNumber)) {
          break;
        }

        const pageObjectName = getPageObjectName(
          pageNumber,
          manifest.pageExtension,
        );

        if (!cachedPageSet.has(pageObjectName)) {
          return null;
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

      if (
        requestedPagesReady ||
        (
          manifest.status === "failed" &&
          readyPages.length > 0
        )
      ) {
        const nextPageFrom =
          pageFrom + readyPages.length;

        const hasMore =
          nextPageFrom < manifest.renderPageCount;

        return {
          pageCount: manifest.pageCount,
          renderedPageCount: manifest.renderPageCount,
          pageFrom,
          pages: readyPages,
          variant,
          hasMore,
          nextPageFrom: hasMore
            ? nextPageFrom
            : null,
          upgradeRequired,
          upgradePage: upgradeRequired
            ? FREE_PREVIEW_PAGE_LIMIT + 1
            : null,
          renderingStatus: manifest.status,
        };
      }

      if (manifest.status === "failed") {
        throw createHttpError(
          "Preview generation was interrupted. Please retry.",
          503,
        );
      }
    }

    await sleep(PREVIEW_POLL_INTERVAL_MS);
  }

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
        const freeLimited = authorization.freeLimited;

        const sourceVersion = sha256(
          [
            resource.id,
            resource.file_path,
            resource.updated_at ?? "",
            resource.mime_type ?? "",
          ].join("|"),
        );

        const variant = freeLimited
          ? "free"
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
            resource.id,
          );

        if (!completedCache) {
          ensureRenderJob({
            cacheKey,
            supabase,
            resource,
            freeLimited,
            folder,
            sourceVersion,
            variant,
          });
        }

let result = await waitForRequestedPages({
  supabase,
  folder,
  resourceId: resource.id,
  sourceVersion,
  variant,
  pageFrom,
  requestedPageCount: pageCount,
});

/*
 * A null result means the manifest is invalid
 * or one of its recorded page objects is missing.
 * Start or resume rendering to repair the cache.
 */
if (!result) {
  ensureRenderJob({
    cacheKey,
    supabase,
    resource,
    freeLimited,
    folder,
    sourceVersion,
    variant,
  });

  result = await waitForRequestedPages({
    supabase,
    folder,
    resourceId: resource.id,
    sourceVersion,
    variant,
    pageFrom,
    requestedPageCount: pageCount,
  });
}

if (!result) {
  throw createHttpError(
    "The preview cache could not be recovered. Please retry.",
    503,
  );
}

res.setHeader(
  "Cache-Control",
  "private, no-store",
);

return res.status(200).json({
  resourceId: resource.id,
  pageCount: result.pageCount,
  renderedPageCount: result.renderedPageCount,
  pageFrom: result.pageFrom,
  variant: result.variant,
  pages: result.pages,
  nextPageFrom: result.nextPageFrom,
  hasMore: result.hasMore,
  upgradeRequired: result.upgradeRequired,
  upgradePage: result.upgradePage,
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