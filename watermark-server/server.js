import express from "express";
import cors from "cors";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  WATERMARK,
  createWatermarkSvg,
} from "./watermarkTemplate.js";
import {
  createPreviewRenderer,
} from "./previewRenderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

dotenv.config({
  path: "../.env",
  override: false,
});

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "20mb",
  }),
);

const WATERMARK_SERVER_SECRET =
  process.env.WATERMARK_SERVER_SECRET;

if (!WATERMARK_SERVER_SECRET) {
  throw new Error(
    "WATERMARK_SERVER_SECRET is missing",
  );
}

createPreviewRenderer({
  app,
  supabase,
  watermarkSecret: WATERMARK_SERVER_SECRET,
});

function requireWatermarkSecret(req, res, next) {
  const suppliedSecret =
    req.headers["x-watermark-secret"];

  if (
    typeof suppliedSecret !== "string" ||
    suppliedSecret !== WATERMARK_SERVER_SECRET
  ) {
    return res.status(401).json({
      error: "Unauthorized.",
    });
  }

  next();
}

// -------------------------------------------------
// PDF Watermarking
// -------------------------------------------------

async function processPdf(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const watermarkWidth = Math.round(
      Math.min(width, height) * 1.5,
    );

    const watermarkBuffer = await sharp(
      path.join(__dirname, "aneks-watermark.png"),
    )
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

    const rotatedMeta =
      await sharp(watermarkBuffer).metadata();

    const wmWidth = rotatedMeta.width ?? 0;
    const wmHeight = rotatedMeta.height ?? 0;

    const watermarkImage =
      await pdfDoc.embedPng(watermarkBuffer);

    page.drawImage(watermarkImage, {
      x: (width - wmWidth) / 2,
      y: (height - wmHeight) / 2,
      width: wmWidth,
      height: wmHeight,
      opacity: WATERMARK.opacity,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

// -------------------------------------------------
// Health Check
// -------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    service: "Aneks Library Watermark Server",
    status: "Running",
  });
});

// -------------------------------------------------
// Image Watermarking
// -------------------------------------------------

app.post(
  "/watermark",
  requireWatermarkSecret,
  async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          error: "Missing image.",
        });
      }

      const imageBuffer = Buffer.from(
        image,
        "base64",
      );

      console.log(
        "Received image:",
        imageBuffer.length,
        "bytes",
      );

      const original = sharp(imageBuffer);
      const metadata = await original.metadata();

      const format = metadata.format ?? "jpeg";
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      if (!width || !height) {
        return res.status(400).json({
          error: "Unable to determine image size.",
        });
      }

      const watermarkSvg = createWatermarkSvg(
        width,
        height,
      );

      const watermarkBuffer = Buffer.from(
        watermarkSvg,
      );

      const watermark = await sharp(watermarkBuffer)
        .png()
        .toBuffer();

      const meta = await sharp(watermark).metadata();

      const wmWidth = meta.width ?? width;
      const wmHeight = meta.height ?? height;

      const composites = [
        {
          input: watermark,
          left: Math.round((width - wmWidth) / 2),
          top: Math.round((height - wmHeight) / 2),
        },
      ];

      const processed = original.composite(composites);

      let output;

      switch (format) {
        case "png":
          output = await processed.png().toBuffer();
          break;

        case "webp":
          output = await processed
            .webp({
              quality: 100,
            })
            .toBuffer();
          break;

        default:
          output = await processed
            .jpeg({
              quality: 100,
            })
            .toBuffer();
      }

      let contentType = "image/jpeg";

      if (format === "png") {
        contentType = "image/png";
      }

      if (format === "webp") {
        contentType = "image/webp";
      }

      res.setHeader("Content-Type", contentType);

      return res.send(output);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : String(err);

      const stderr =
        typeof err === "object" &&
        err !== null &&
        "stderr" in err
          ? String(err.stderr)
          : "";

      console.error("Image watermarking failed:", {
        message,
        stderr: stderr.trim(),
      });

      return res.status(500).json({
        error: "Unable to process this image.",
      });
    }
  },
);

// -------------------------------------------------
// PDF Watermarking Endpoint
// -------------------------------------------------

app.post(
  "/watermark-pdf",
  requireWatermarkSecret,
  async (req, res) => {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({
          error: "Missing filePath.",
        });
      }

      const {
        data: pdfBlob,
        error: downloadError,
      } = await supabase.storage
        .from("resources")
        .download(filePath);

      if (downloadError || !pdfBlob) {
        console.error(
          "PDF Storage download failed:",
          downloadError,
        );

        return res.status(404).json({
          error: "Unable to download PDF from Storage.",
        });
      }

      const pdfBytes = Buffer.from(
        await pdfBlob.arrayBuffer(),
      );

      console.log(
        "Downloaded PDF:",
        pdfBytes.length,
        "bytes",
      );

      const output = await processPdf(pdfBytes);

      res.setHeader(
        "Content-Type",
        "application/pdf",
      );

      return res.send(output);
        } catch (err) {
      console.error("PDF watermarking failed:", err);

      return res.status(500).json({
        error: "Unable to process this PDF.",
      });
    }
  },
);

// -------------------------------------------------
// Start Server
// -------------------------------------------------

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Watermark server running on port ${PORT}`,
  );
});