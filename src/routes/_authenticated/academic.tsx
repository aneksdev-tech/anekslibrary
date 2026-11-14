import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/academic")({
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

    const { data: profile, error } = await supabase
      .from("private_profiles")
      .select("primary_role, status")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }

    if (profile.status !== "active") {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }

    if (
      !profile.primary_role ||
      !["admin", "co-admin", "lecturer"].includes(
        profile.primary_role,
      )
    ) {
  throw redirect({
    to: "/dashboard",
    replace: true,
  });
}
  },

  component: AcademicLayout,
});

function AcademicLayout() {
  return <Outlet />;
}