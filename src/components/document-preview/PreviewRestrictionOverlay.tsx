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

      <h3 className="mt-5 text-base font-semibold sm:text-lg">
        Continue with Premium
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground lg:text-lg">
        Unlock the remaining pages and enjoy full access to exclusive academic resources and other Premium benefits.
      </p>

      {onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="group mt-5 inline-flex min-h-10 w-50 items-center justify-center rounded-sm bg-gradient-emerald px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:bg-none hover:bg-accent hover:shadow-md"
        >
          <span className="transition-colors group-hover:text-primary">
            Upgrade to Premium
          </span>
        </button>
      )}
    </div>
  );
}