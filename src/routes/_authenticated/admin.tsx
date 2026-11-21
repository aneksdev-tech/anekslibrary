import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardCheck,
  Files,
  Users,
  Tags,
  Megaphone,
  Loader2,
} from "lucide-react";
import { requireRole } from "@/lib/route-guards";
import { useAuth } from "@/lib/auth";
import {
  canManageAnnouncements,
  canManageUsers,
} from "@/lib/permissions";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    const restrictedToAdmin = [
      "/admin/resources",
      "/admin/categories",
      "/admin/users",
    ].some(
      (path) =>
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`),
    );

    if (restrictedToAdmin) {
      return requireRole(
        ["admin", "co-admin"],
        location.pathname,
      );
    }

    const announcementsPath =
      location.pathname === "/admin/announcements" ||
      location.pathname.startsWith("/admin/announcements/");

    if (announcementsPath) {
      return requireRole(
        ["admin", "co-admin", "staff"],
        location.pathname,
      );
    }

    return requireRole(
      ["admin", "co-admin", "staff"],
      location.pathname,
    );
  },

  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const activeRouteIds = useRouterState({
    select: (router) =>
      router.matches.map((match) => match.routeId),
  });

  const navigate = useNavigate();

  const auth = useAuth();
  const user = auth.user;
  const roles = auth.roles ?? [];

  const canManagePlatform = canManageUsers(roles);
  const canManageAnnouncementAccess =
    canManageAnnouncements(roles);

  const hasAdminWorkspaceAccess =
    roles.includes("admin") ||
    roles.includes("co-admin") ||
    roles.includes("staff");

  // Identify the actual user-detail route from the active route matches.
  // This avoids relying only on a pathname check during navigation.
  const isUserDetailRoute = activeRouteIds.some(
    (routeId) =>
      routeId === "/_authenticated/admin/users/$userId",
  );

  const {
    data: approvalCount = 0,
  } = useQuery({
    queryKey: [
      "approval-attention-count",
      user?.id,
      roles,
    ],
    enabled: !!user && !isUserDetailRoute,
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_approval_attention_count",
      );

      if (error) {
        throw error;
      }

      return data ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;

    if (!hasAdminWorkspaceAccess) {
      void navigate({
        to: "/",
        replace: true,
      });
    }
  }, [user, hasAdminWorkspaceAccess, navigate]);

  if (user && !hasAdminWorkspaceAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Redirecting...
        </div>
      </div>
    );
  }

  // Render user profiles without the Control Room shell.
  // The parent route's beforeLoad authorization remains active.
  if (isUserDetailRoute) {
    return (
      <div className="min-w-0 w-full">
        <Outlet />
      </div>
    );
  }

  const tabs = [
    {
      to: "/admin",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      to: "/admin/approvals",
      label: "Approvals",
      icon: ClipboardCheck,
    },
    ...(canManageAnnouncementAccess
      ? [
          {
            to: "/admin/announcements",
            label: "Announcements",
            icon: Megaphone,
          },
        ]
      : []),
    ...(canManagePlatform
      ? [
          {
            to: "/admin/categories",
            label: "Categories",
            icon: Tags,
          },
          {
            to: "/admin/resources",
            label: "Resources",
            icon: Files,
          },
          {
            to: "/admin/users",
            label: "Users",
            icon: Users,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Admin Header */}
      <section>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold sm:text-xs sm:tracking-[0.22em]">
            Administration
          </p>

          <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:px-2 sm:py-1 sm:text-[10px]">
            {roles[0] ?? "Member"}
          </span>
        </div>

        <h1 className="mt-1 font-display text-xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
          Control Room
        </h1>

        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
          Manage library operations, review submissions, and maintain
          the platform from one central workspace.
        </p>
      </section>

      {/* Admin Navigation */}
      <nav
        aria-label="Administration navigation"
        className="rounded-sm border border-border bg-card p-1 shadow-soft sm:p-1.5"
      >
        <div
          className={`grid gap-1 ${
            tabs.length === 3
              ? "grid-cols-3"
              : "grid-cols-2"
          } sm:flex sm:flex-wrap`}
        >
          {tabs.map((tab) => {
            const active =
              tab.to === "/admin"
                ? pathname === "/admin"
                : pathname === tab.to ||
                  pathname.startsWith(`${tab.to}/`);

            const Icon = tab.icon;

            return (
              <Link
                key={tab.to}
                to={tab.to}
                preload={false}
                className={`group relative flex min-h-9 min-w-0 items-center justify-start gap-1 rounded-sm px-1.5 py-1.5 pb-2 text-[9px] font-medium transition-colors duration-200 sm:min-h-11 sm:flex-1 sm:gap-2 sm:px-4 sm:py-2.5 sm:pb-3 sm:text-sm ${
                  active
                    ? "text-gold"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-3 w-3 shrink-0 transition-transform duration-200 sm:h-4 sm:w-4 ${
                    active ? "" : "group-hover:scale-105"
                  }`}
                />

                <span className="min-w-0 truncate">
                  {tab.label}
                </span>

                {tab.to === "/admin/approvals" &&
                approvalCount > 0 ? (
                  <span
                    className="ml-0.5 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[8px] font-semibold !text-black sm:ml-0 sm:h-5 sm:min-w-5 sm:text-[10px]"
                    aria-label={`${approvalCount} pending approval items`}
                  >
                    {approvalCount > 99 ? "99+" : approvalCount}
                  </span>
                ) : null}

                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-0.5 origin-left rounded-full bg-gold transition-all duration-200 ease-in-out ${
                    active
                      ? "scale-x-100 opacity-100"
                      : "scale-x-0 opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Active Admin Page */}
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}