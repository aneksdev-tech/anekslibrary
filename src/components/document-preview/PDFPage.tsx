import { Page } from "react-pdf";
import { WatermarkOverlay } from "./WatermarkOverlay";
import { PreviewRestrictionOverlay } from "./PreviewRestrictionOverlay";

interface PDFPageProps {
  pageNumber: number;
  width: number;
  restrictPreview?: boolean;
  onUpgradeClick?: () => void;
}

export function PDFPage({
  pageNumber,
  width,
  restrictPreview = false,
  onUpgradeClick,
}: PDFPageProps) {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border bg-background shadow-soft">
      <Page
        pageNumber={pageNumber}
        width={width}
        devicePixelRatio={Math.min(
          window.devicePixelRatio || 1,
          2,
        )}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="relative z-10"
      />

      <WatermarkOverlay />

      {restrictPreview && (
        <PreviewRestrictionOverlay
          onUpgradeClick={onUpgradeClick}
        />
      )}
    </div>
  );
}