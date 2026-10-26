import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, pdfjs } from "react-pdf";
import { PDFPage } from "./PDFPage";
import { PreviewRestrictionOverlay } from "./PreviewRestrictionOverlay";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  url: string;
  scrollRoot?: HTMLDivElement | null;
  restrictPreview?: boolean;
  onUpgradeClick?: () => void;
}

export function PDFViewer({
  url,
  scrollRoot = null,
  restrictPreview = false,
  onUpgradeClick,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(900);
  const [visiblePages, setVisiblePages] = useState(3);

  const containerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMorePages = useCallback(() => {
    setVisiblePages((prev) =>
      Math.min(prev + 3, numPages),
    );
  }, [numPages]);

  const pdfOptions = useMemo(
    () => ({
      wasmUrl: "/wasm/",
      cMapUrl: "/cmaps/",
      cMapPacked: true,
    }),
    [],
  );

  useEffect(() => {
    setVisiblePages(3);
    setNumPages(0);
  }, [url]);

  useEffect(() => {
    function updateWidth() {
      if (!containerRef.current) return;

      setPageWidth(
        containerRef.current.clientWidth + 4,
      );
    }

    updateWidth();

    const resizeObserver = new ResizeObserver(
      updateWidth,
    );

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener(
      "resize",
      updateWidth,
    );

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener(
        "resize",
        updateWidth,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !loaderRef.current ||
      !numPages ||
      visiblePages >= numPages
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (
          entry?.isIntersecting &&
          visiblePages < numPages
        ) {
          loadMorePages();
        }
      },
      {
        root: scrollRoot ?? null,
        rootMargin: "600px 0px",
      },
    );

    observer.observe(loaderRef.current);

    return () => {
      observer.disconnect();
    };
  }, [
    scrollRoot,
    visiblePages,
    numPages,
    loadMorePages,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full space-y-4"
    >
      <Document
        file={url}
        options={pdfOptions}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setVisiblePages(
            Math.min(3, numPages),
          );
        }}
        onLoadError={() => {}}
        loading={
          <div className="flex h-64 items-center justify-center rounded-2xl border bg-muted/30">
            Loading PDF...
          </div>
        }
        error={
          <div className="flex h-64 items-center justify-center rounded-2xl border bg-muted/30 text-sm text-muted-foreground">
            Failed to load PDF preview.
          </div>
        }
      >
        {Array.from(
          {
            length: Math.min(
              visiblePages,
              numPages,
            ),
          },
          (_, i) => (
              <PDFPage
              key={i}
              pageNumber={i + 1}
              width={pageWidth}
              restrictPreview={restrictPreview}
              onUpgradeClick={onUpgradeClick}
            />
          ),
        )}

        {visiblePages < numPages && (
          <div
            ref={loaderRef}
            className="h-10"
            aria-hidden="true"
          />
        )}
      </Document>
    </div>
  );
}