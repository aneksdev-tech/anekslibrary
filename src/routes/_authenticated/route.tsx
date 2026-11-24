import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,

  beforeLoad: async ({ location }) => {
  const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.user) {
  throw redirect({
    to: "/auth",
    search: {
      mode: "login",
      next: location.pathname,
    },
  });
}

    const {
  data: profile,
  error: profileError,
} = await supabase
  .from("private_profiles")
  .select("status")
  .eq("id", session.user.id)
  .maybeSingle();

if (profileError) {
  console.error(
    "Unable to verify authenticated user's profile:",
    profileError.message,
  );

  throw profileError;
}

if (!profile) {
  // The authenticated user no longer has an application profile.
  await supabase.auth.signOut({
    scope: "local",
  });

  throw redirect({
    to: "/auth",
    search: {
      mode: "login",
    },
    replace: true,
  });
}

    const currentPath = location.pathname;

    const isPendingPage =
      currentPath === "/pending";

    const isSuspendedPage =
      currentPath === "/suspended";

    const isRejectedPage =
      currentPath === "/rejected";

    const isInactivePage =
      currentPath === "/inactive";

    switch (profile?.status) {
      case "pending":
        if (!isPendingPage) {
          throw redirect({
            to: "/pending",
            replace: true,
          });
        }
        break;

      case "suspended":
        if (!isSuspendedPage) {
          throw redirect({
            to: "/suspended",
            replace: true,
          });
        }
        break;

      case "rejected":
        if (!isRejectedPage) {
          throw redirect({
            to: "/rejected",
            replace: true,
          });
        }
        break;

      case "inactive":
        if (!isInactivePage) {
          throw redirect({
            to: "/inactive",
            replace: true,
          });
        }
        break;

      case "active":
        if (
          isPendingPage ||
          isSuspendedPage ||
          isRejectedPage ||
          isInactivePage
        ) {
          throw redirect({
            to: "/dashboard",
            replace: true,
          });
        }
        break;

      default:
        throw redirect({
          to: "/pending",
          replace: true,
        });
    }

    return {
  user: session.user,
  profile,
};
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !profile) {
      return;
    }

    const currentPath =
      window.location.pathname;

    if (profile.status === "active") {
      if (
        currentPath === "/pending" ||
        currentPath === "/suspended" ||
        currentPath === "/rejected" ||
        currentPath === "/inactive"
      ) {
        window.location.replace("/dashboard");
      }

      return;
    }

    switch (profile.status) {
      case "pending":
        if (currentPath !== "/pending") {
          window.location.replace("/pending");
        }
        break;

      case "suspended":
        if (currentPath !== "/suspended") {
          window.location.replace("/suspended");
        }
        break;

      case "rejected":
        if (currentPath !== "/rejected") {
          window.location.replace("/rejected");
        }
        break;

      case "inactive":
        if (currentPath !== "/inactive") {
          window.location.replace("/inactive");
        }
        break;

      default:
        if (currentPath !== "/pending") {
          window.location.replace("/pending");
        }
        break;
    }
  }, [profile?.status, loading]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}