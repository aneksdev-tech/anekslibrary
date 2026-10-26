import { WatermarkOverlay } from "./WatermarkOverlay";
import { PreviewRestrictionOverlay } from "./PreviewRestrictionOverlay";

interface ImageViewerProps {
  url: string;
  alt?: string;
  restrictPreview?: boolean;
  onUpgradeClick?: () => void;
}

export function ImageViewer({
  url,
  alt,
  restrictPreview = false,
  onUpgradeClick,
}: ImageViewerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className="
          block
          w-full
          rounded-2xl
          select-none
          pointer-events-none
          [-webkit-user-drag:none]
          [-webkit-touch-callout:none]
        "
      />

      <WatermarkOverlay />

      {/* Invisible interaction shield */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20"
      />

      {/* Keep the upgrade button above the shield */}
      {restrictPreview && (
        <PreviewRestrictionOverlay
          onUpgradeClick={onUpgradeClick}
        />
      )}
    </div>
  );
}