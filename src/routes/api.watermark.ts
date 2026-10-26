import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import path from "node:path";

const BUCKET = "resources";
const OUTPUT_BUCKET = "watermarked-temp";

const WATERMARK = {
  text: "ANEKS LIBRARY",
  rotation: 55,
  imageOpacity: 0.4,
  pdfOpacity: 0.4,
};

type WatermarkType = "image" | "pdf";

type WatermarkAssets = {
  watermarkPng: Buffer;
};

type WatermarkRequestBody = {
  filePath?: unknown;
  type?: unknown;
};

let assetsPromise: Promise<WatermarkAssets> | undefined;

async function loadAssets(
  request: Request,
): Promise<WatermarkAssets> {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const assetUrl = (filename: string) =>
        new URL(`/watermark-assets/${filename}`, request.url);

      const pngResponse = await fetch(
        assetUrl("aneks-watermark.png"),
      );

      if (!pngResponse.ok) {
        throw new Error("Unable to load watermark assets.");
      }

      return {
        watermarkPng: Buffer.from(
          await pngResponse.arrayBuffer(),
        ),
      };
    })().catch((error) => {
      assetsPromise = undefined;
      throw error;
    });
  }

  return assetsPromise;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isSafeResourcePath(
  filePath: unknown,
): filePath is string {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.length > 1024 ||
    filePath.startsWith("/") ||
    filePath.includes("\\") ||
    filePath.includes("\0") ||
    filePath.includes("://")
  ) {
    return false;
  }

  const segments = filePath.split("/");

  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== "..",
  );
}

function getImageContentType(
  format: string,
): string | null {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

async function watermarkImage(
  originalBytes: Buffer,
  assets: WatermarkAssets,
): Promise<{ bytes: Buffer; contentType: string }> {
  const metadata = await sharp(originalBytes).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const contentType = getImageContentType(
    metadata.format ?? "",
  );

  if (!width || !height || !contentType) {
    throw new Error("Unsupported or invalid image.");
  }

  // Calculate watermark width relative to the original image.
  const watermarkWidth = Math.max(
    1,
    Math.round(Math.min(width, height) * 1.5),
  );

  // Intentionally allow the watermark to enlarge.
  const rotatedWatermark = await sharp(
    assets.watermarkPng,
  )
    .resize({
      width: watermarkWidth,
    })
    .rotate(-WATERMARK.rotation, {
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const rotatedMetadata =
    await sharp(rotatedWatermark).metadata();

  const rotatedWidth = rotatedMetadata.width ?? 0;
  const rotatedHeight = rotatedMetadata.height ?? 0;

  if (!rotatedWidth || !rotatedHeight) {
    throw new Error("Unable to prepare watermark image.");
  }

  // Clip the rotated watermark to the original image bounds,
  // keeping its center aligned instead of shrinking it.
  const cropWidth = Math.min(width, rotatedWidth);
  const cropHeight = Math.min(height, rotatedHeight);

  const cropLeft = Math.max(
    0,
    Math.floor((rotatedWidth - cropWidth) / 2),
  );

  const cropTop = Math.max(
    0,
    Math.floor((rotatedHeight - cropHeight) / 2),
  );

  const croppedWatermark = await sharp(rotatedWatermark)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();

  // Restore transparent padding where the watermark is smaller
  // than the original image.
  const left = Math.floor((width - cropWidth) / 2);
  const right = width - cropWidth - left;
  const top = Math.floor((height - cropHeight) / 2);
  const bottom = height - cropHeight - top;

  const centeredWatermark = await sharp(croppedWatermark)
    .extend({
      left,
      right,
      top,
      bottom,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .png()
    .toBuffer();

  // Apply the configured watermark opacity to the alpha channel.
  const watermarkWithAlpha = await sharp(centeredWatermark)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = watermarkWithAlpha;

  for (
    let index = 3;
    index < data.length;
    index += info.channels
  ) {
    data[index] = Math.round(
      data[index] * WATERMARK.imageOpacity,
    );
  }

  const watermark = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();

  const processed = sharp(originalBytes).composite([
    {
      input: watermark,
      left: 0,
      top: 0,
      blend: "over",
    },
  ]);

  let bytes: Buffer;

  switch (metadata.format) {
    case "png":
      bytes = await processed.png().toBuffer();
      break;

    case "webp":
      bytes = await processed
        .webp({ quality: 100 })
        .toBuffer();
      break;

    default:
      bytes = await processed
        .jpeg({ quality: 100 })
        .toBuffer();
      break;
  }

  return { bytes, contentType };
}

async function watermarkPdf(
  originalBytes: Buffer,
  watermarkPng: Buffer,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(originalBytes);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const watermarkWidth = Math.round(
      Math.min(width, height) * 1.5,
    );

    // Intentionally prevent the watermark from enlarging.
    const rotatedWatermark = await sharp(watermarkPng)
      .resize({
        width: watermarkWidth,
        withoutEnlargement: true,
      })
      .rotate(-WATERMARK.rotation, {
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        },
      })
      .png()
      .toBuffer();

    const watermarkMetadata = await sharp(
      rotatedWatermark,
    ).metadata();

    const watermarkImage = await pdf.embedPng(
      rotatedWatermark,
    );

    const imageWidth = watermarkMetadata.width ?? 0;
    const imageHeight = watermarkMetadata.height ?? 0;

    page.drawImage(watermarkImage, {
      x: (width - imageWidth) / 2,
      y: (height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
      opacity: WATERMARK.pdfOpacity,
    });
  }

  return Buffer.from(await pdf.save());
}

async function handleWatermark(
  request: Request,
): Promise<Response> {
  const expectedSecret =
    process.env.WATERMARK_SERVER_SECRET;

  const suppliedSecret =
    request.headers.get("X-Watermark-Secret");

  if (
    !expectedSecret ||
    !suppliedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return jsonResponse(
      { error: "Unauthorized." },
      401,
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Watermark server environment is incomplete.",
    );

    return jsonResponse(
      { error: "Watermark service is not configured." },
      500,
    );
  }

  let projectHost: string;

  try {
    const parsedSupabaseUrl = new URL(supabaseUrl);

    if (
      parsedSupabaseUrl.protocol !== "https:" ||
      parsedSupabaseUrl.username ||
      parsedSupabaseUrl.password
    ) {
      throw new Error("Invalid Supabase project URL.");
    }

    projectHost = parsedSupabaseUrl.hostname;
  } catch {
    console.error("Watermark Supabase URL is invalid.");

    return jsonResponse(
      { error: "Watermark service is not configured." },
      500,
    );
  }

  let body: WatermarkRequestBody;

  try {
    const contentType =
      request.headers.get("content-type");

    const rawBody = await request.text();

    if (!rawBody.trim()) {
      return jsonResponse(
        { error: "Request body is empty." },
        400,
      );
    }

    if (
      !contentType
        ?.toLowerCase()
        .includes("application/json")
    ) {
      return jsonResponse(
        {
          error:
            "Content-Type must be application/json.",
        },
        415,
      );
    }

    const parsedBody: unknown = JSON.parse(rawBody);

    if (
      typeof parsedBody !== "object" ||
      parsedBody === null ||
      Array.isArray(parsedBody)
    ) {
      return jsonResponse(
        { error: "Request body must be a JSON object." },
        400,
      );
    }

    body = parsedBody as WatermarkRequestBody;
  } catch (error) {
    console.error(
      "Watermark JSON parsing failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      { error: "Invalid JSON request." },
      400,
    );
  }

  const { filePath, type } = body;

  if (!isSafeResourcePath(filePath)) {
    return jsonResponse(
      { error: "Invalid resource path." },
      400,
    );
  }

  if (type !== "image" && type !== "pdf") {
    return jsonResponse(
      { error: "Type must be image or pdf." },
      400,
    );
  }

  const watermarkType: WatermarkType = type;

  const extension = path.extname(filePath).toLowerCase();

  const supportedImage = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ].includes(extension);

  if (
    (watermarkType === "image" && !supportedImage) ||
    (watermarkType === "pdf" && extension !== ".pdf")
  ) {
    return jsonResponse(
      {
        error:
          "File type does not match the requested operation.",
      },
      400,
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const {
      data: originalBlob,
      error: downloadError,
    } = await supabase.storage
      .from(BUCKET)
      .download(filePath);

    if (downloadError || !originalBlob) {
      console.error(
        "Watermark original download failed:",
        {
          projectHost,
          message: downloadError?.message,
          statusCode: downloadError?.statusCode,
        },
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve the original resource.",
        },
        404,
      );
    }

    const originalBytes = Buffer.from(
      await originalBlob.arrayBuffer(),
    );

    const assets = await loadAssets(request);

    let outputBytes: Buffer;
    let outputContentType: string;

    if (watermarkType === "image") {
      const result = await watermarkImage(
        originalBytes,
        assets,
      );

      outputBytes = result.bytes;
      outputContentType = result.contentType;
    } else {
      outputBytes = await watermarkPdf(
        originalBytes,
        assets.watermarkPng,
      );

      outputContentType = "application/pdf";
    }

    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    const originalName = path.posix
      .basename(filePath)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const outputName = `${timestamp}-${originalName}`;
    const outputPath = `${requestId}/${outputName}`;

    const { error: uploadError } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(outputPath, outputBytes, {
        contentType: outputContentType,
        upsert: false,
        cacheControl: "0",
      });

    if (uploadError) {
      console.error("Watermarked file upload failed:", {
        projectHost,
        bucket: OUTPUT_BUCKET,
        requestedPath: outputPath,
        message: uploadError.message,
        statusCode: uploadError.statusCode,
      });

      return jsonResponse(
        { error: "Unable to store the processed resource." },
        500,
      );
    }

    return jsonResponse({
      success: true,
      bucket: OUTPUT_BUCKET,
      path: outputPath,
      contentType: outputContentType,
      filename: outputName,
      size: outputBytes.length,
    });
  } catch (error) {
    console.error(
      "Watermark processing failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      { error: "Unable to process this resource." },
      500,
    );
  }
}

export const Route = createFileRoute("/api/watermark")({
  server: {
    handlers: {
      POST: ({ request }) => handleWatermark(request),
    },
  },
});