import { LockKeyhole } from "lucide-react";

interface PreviewRestrictionOverlayProps {
  onUpgradeClick?: () => void;
}

export function PreviewRestrictionOverlay({
  onUpgradeClick,
}: PreviewRestrictionOverlayProps) {
  return (
    <>
    {/* Frosted-glass cover over the right half */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-1/2 border-l border-border/40 bg-background/75 shadow-[-8px_0_24px_rgba(0,0,0,0.04)] backdrop-blur-xl"
        style={{
          WebkitBackdropFilter: "blur(24px)",
        }}
      />

      {/* Premium upgrade prompt */}
      <div className="absolute right-2 top-1/2 z-20 w-[46%] -translate-y-1/2 sm:right-4">
        <div className="p-2 text-center sm:p-4">
          <LockKeyhole className="mx-auto h-4 w-4 text-gold sm:h-6 sm:w-6" />

          <p className="mt-1 text-[10px] font-semibold leading-tight sm:mt-2 sm:text-sm">
            Premium Preview
          </p>

          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground sm:mt-2 sm:text-xs">
            Upgrade to read the full document.
        </p>

          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="mt-2 inline-flex min-h-7 items-center justify-center rounded-sm bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:mt-3 sm:min-h-9 sm:px-3 sm:text-xs"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>
    </>
  );
}