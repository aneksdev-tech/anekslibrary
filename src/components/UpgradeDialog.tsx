import {
  Crown,
  CheckCircle2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({
  open,
  onOpenChange,
}: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100%-24px)]
          max-w-[360px]
          max-h-[85dvh]
          overflow-y-auto
          rounded-lg
          p-4
          sm:max-w-sm
          sm:rounded-xl
          sm:p-6
        "
      >
        <DialogHeader className="space-y-2 text-left sm:space-y-3">
          <Crown className="h-5 w-5 text-yellow-500 sm:h-7 sm:w-7" />
        
          <DialogTitle className="text-left text-base font-semibold leading-snug sm:text-2xl">
            Unlock Unlimited Academic Resources
          </DialogTitle>

          <DialogDescription className="text-left text-[11px] leading-[1.45rem] sm:text-sm sm:leading-6">
            Upgrade your account to enjoy unlimited downloads,
            premium academic resources, an ad-free experience,
            priority support, and early access to new features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1 sm:space-y-2.5 sm:py-2">
          <Feature text="Unlimited downloads" />
          <Feature text="Premium academic resources" />
          <Feature text="No advertisements" />
          <Feature text="Priority support" />
          <Feature text="Early access to new features" />
          <Feature text="Premium member badge" />
        </div>

        <div className="rounded-md border bg-primary/5 p-2.5 text-left sm:rounded-xl sm:p-4">
          <p className="text-xl font-bold sm:text-3xl">
            ₦3,000
            <span className="text-sm font-normal sm:text-lg">
              /month
            </span>
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="h-9 w-full text-xs sm:h-10 sm:text-sm"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>

          <Button
            className="h-9 w-full text-xs sm:h-10 sm:text-sm"
            onClick={() => {
              // Flutterwave checkout will be added here.
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Feature({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 sm:h-5 sm:w-5" />

      <span className="text-[11px] leading-4 sm:text-sm sm:leading-normal">
        {text}
      </span>
    </div>
  );
}