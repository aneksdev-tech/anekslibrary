import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import { ImageViewer } from "./ImageViewer";
import { DocxViewer } from "./DocxViewer";

interface DocumentPreviewProps {
  url: string;
  token: string;
  filePath: string;
  title?: string;
  scrollRoot?: HTMLDivElement | null;
  restrictPreview?: boolean;
  onUpgradeClick?: () => void;
}

/*
 * Cache the in-flight preview request so React development-mode
 * effect re-runs do not download the same document twice.
 *
 * The Edge Function now returns a short-lived signed Storage URL,
 * which is then used to retrieve the actual file.
 */
const previewRequests = new Map<
  string,
  Promise<Blob>
>();

function getPreviewBlob(
  url: string,
  token: string,
): Promise<Blob> {
  const cacheKey = `${url}|${token}`;

  const existingRequest =
    previewRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      /*
       * First request:
       * Authenticate and authorize through the preview
       * Edge Function. It now returns JSON containing a
       * short-lived signed Storage URL.
       */
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey:
            import.meta.env
              .VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(
          "Unable to authorize preview.",
        );
      }

      const data: {
        url?: string;
      } = await response.json();

      if (!data.url) {
        throw new Error(
          "Preview access URL was not returned.",
        );
      }

      /*
       * Second request:
       * Download the actual private resource directly
       * from Supabase Storage using the short-lived
       * signed URL.
       */
      const fileResponse =
        await fetch(data.url);

      if (!fileResponse.ok) {
        throw new Error(
          "Unable to load preview file.",
        );
      }

      const previewBlob =
        await fileResponse.blob();

      if (previewBlob.size === 0) {
        throw new Error(
          "The preview file is empty.",
        );
      }

      return previewBlob;
    } catch (error) {
      /*
       * Do not keep failed requests in the cache.
       * This allows a later retry to make a fresh request.
       */
      previewRequests.delete(cacheKey);
      throw error;
    }
  })();

  previewRequests.set(
    cacheKey,
    request,
  );

  return request;
}

export function DocumentPreview({
  url,
  token,
  filePath,
  title,
  scrollRoot = null,
  restrictPreview = false,
  onUpgradeClick,
}: DocumentPreviewProps) {
  const [blob, setBlob] =
    useState<Blob>();

  const [blobUrl, setBlobUrl] =
    useState<string>();

  const [previewError, setPreviewError] =
    useState(false);

  useEffect(() => {
    let objectUrl:
      | string
      | undefined;

    let cancelled = false;

    async function loadPreview() {
      setPreviewError(false);
      setBlob(undefined);
      setBlobUrl(undefined);

      try {
        const previewBlob =
          await getPreviewBlob(
            url,
            token,
          );

        if (cancelled) {
          return;
        }

        objectUrl =
          URL.createObjectURL(
            previewBlob,
          );

        setBlob(previewBlob);
        setBlobUrl(objectUrl);
      } catch (error) {
        console.error(
          "Document preview failed:",
          error,
        );

        if (!cancelled) {
          setPreviewError(true);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, [url, token]);

  const disableContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
  };

  const ext = filePath
    .split(".")
    .pop()
    ?.toLowerCase();

  if (previewError) {
    return (
      <div className="flex h-[70vh] items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-lg font-semibold">
            Unable to load preview
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't load this file preview. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!blob || !blobUrl) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        Preparing preview...
      </div>
    );
  }

  return (
    <div
      onContextMenu={disableContextMenu}
      className="relative select-none"
    >
            {ext === "pdf" ? (
        <PDFViewer
          url={blobUrl}
          scrollRoot={scrollRoot}
          restrictPreview={restrictPreview}
          onUpgradeClick={onUpgradeClick}
        />
      ) : ext === "docx" ? (
        <DocxViewer
          blob={blob}
          restrictPreview={restrictPreview}
          onUpgradeClick={onUpgradeClick}
        />
      ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(
          ext ?? "",
        ) ? (
        <ImageViewer
          url={blobUrl}
          alt={title}
          restrictPreview={restrictPreview}
          onUpgradeClick={onUpgradeClick}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>

          <h3 className="mt-4 text-lg font-semibold">
            Preview not available
          </h3>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This file type is not yet supported for in-browser preview.
            Downloading requires a Premium subscription.
          </p>
        </div>
      )}
    </div>
  );
}