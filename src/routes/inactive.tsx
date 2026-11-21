import { createFileRoute } from "@tanstack/react-router";
import { UserX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inactive")({
  component: InactivePage,
});

function InactivePage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-card p-4 shadow-elegant sm:rounded-smxl sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted sm:h-16 sm:w-16">
          <UserX
            className="h-6 w-6 text-muted-foreground sm:h-8 sm:w-8"
            strokeWidth={2.5}
          />
        </div>

        <h1 className="mt-4 text-center font-display text-xl font-semibold sm:mt-6 sm:text-3xl">
          Account Inactive
        </h1>

        <p className="mt-3 text-center text-xs leading-5 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-7">
          Your Aneks Library account is currently inactive.
        </p>

        <p className="mt-2.5 text-center text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-7">
          You currently cannot access your account or use the library.
          Please contact an administrator if you need your account
          reactivated.
        </p>

        <div className="mt-6 flex justify-center sm:mt-8">
          <Button
            variant="outline"
            className="h-9 px-4 bg-muted text-xs sm:h-10 sm:px-5 sm:text-sm"
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}