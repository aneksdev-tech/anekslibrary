import { LockKeyhole } from "lucide-react";

interface PreviewRestrictionOverlayProps {
  onUpgradeClick?: () => void;
}

export function PreviewRestrictionOverlay({
  onUpgradeClick,
}: PreviewRestrictionOverlayProps) {
  return (
    <div
      className="flex min-h-[420px] w-full flex-col items-center justify-center rounded-sm border border-border bg-muted/20 px-6 py-12 text-center"
      role="region"
      aria-label="Premium preview restriction"
    >
      <div className="rounded-full bg-primary/10 p-4">
        <LockKeyhole className="h-8 w-8 text-gold" />
      </div>

      <h3 className="mt-5 text-lg font-semibold">
        Premium Preview
      </h3>

      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        You've reached the free preview limit for this document.
        Upgrade to Premium to read the full document.
      </p>

      {onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-sm bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Upgrade to Premium
        </button>
      )}
    </div>
  );
}