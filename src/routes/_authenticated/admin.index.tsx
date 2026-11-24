import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Users,
  FileCheck2,
  Download,
  BookMarked,
  HardDrive,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Overview | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

function formatStorage(bytes: number) {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  if (index === 0) {
    return `${Math.round(value)} ${units[index]}`;
  }

  if (value >= 100) {
    return `${value.toFixed(0)} ${units[index]}`;
  }

  if (value >= 10) {
    return `${value.toFixed(1)} ${units[index]}`;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

function AdminOverview() {
  const { loading: authLoading, profile } = useAuth();

  const role = profile?.primary_role;

  const isAdminRole =
    role === "admin" || role === "co-admin";

  const isStaffRole = role === "staff";

  const { data } = useQuery({
    queryKey: ["admin-stats", role],
    enabled: !authLoading && isAdminRole,
    queryFn: async () => {
      const [
        users,
        resources,
        pending,
        pendingUsers,
        downloads,
        bookmarks,
        storage,
      ] = await Promise.all([
        supabase
          .from("private_profiles")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),

        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("private_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase.rpc(
          "get_total_active_resource_downloads",
        ),

        supabase.rpc("get_total_bookmarks"),

        supabase.rpc("get_total_resource_storage"),
      ]);

      if (users.error) {
        throw users.error;
      }

      if (resources.error) {
        throw resources.error;
      }

      if (pending.error) {
        throw pending.error;
      }

      if (pendingUsers.error) {
        throw pendingUsers.error;
      }

      if (downloads.error) {
        throw downloads.error;
      }

      if (bookmarks.error) {
        throw bookmarks.error;
      }

      if (storage.error) {
        throw storage.error;
      }

      return {
        users: users.count ?? 0,
        resources: resources.count ?? 0,
        pending:
          (pending.count ?? 0) +
          (pendingUsers.count ?? 0),
        downloads: Number(downloads.data ?? 0),
        bookmarks: Number(bookmarks.data ?? 0),
        storage: Number(storage.data ?? 0),
      };
    },
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff-overview", role],
    enabled: !authLoading && isStaffRole,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("resources")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "pending");

      if (error) {
        throw error;
      }

      return {
        pending: count ?? 0,
      };
    },
  });

  if (authLoading || !role) {
    return (
      <section className="space-y-5 sm:space-y-6">
        <div className="rounded-sm border border-border bg-card p-3.5 sm:p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-muted sm:h-5 sm:w-40" />
          <div className="mt-2.5 h-3 w-52 animate-pulse rounded bg-muted sm:mt-3 sm:h-4 sm:w-64" />
        </div>
      </section>
    );
  }

  if (isStaffRole) {
    const pendingCount = staffData?.pending ?? 0;

    return (
      <section className="space-y-5 sm:space-y-6">
        {/* Staff overview */}
        <div
          className={`flex items-center justify-between gap-3 rounded-sm border p-3.5 sm:gap-4 sm:p-5 ${
            pendingCount > 0
              ? "border-gold/40 bg-gold/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border sm:h-9 sm:w-9 ${
                pendingCount > 0
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold sm:text-sm">
                Pending Approval
              </p>

              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
                Resources currently awaiting administrative review.
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 font-display text-xl font-semibold sm:text-2xl ${
              pendingCount > 0
                ? "text-gold"
                : "text-foreground"
            }`}
          >
            {pendingCount}
          </span>
        </div>
      </section>
    );
  }

  const stats = [
    {
      label: "Users",
      value: data?.users ?? 0,
      icon: Users,
    },
    {
      label: "Resources",
      value: data?.resources ?? 0,
      icon: FileCheck2,
    },
    {
      label: "Downloads",
      value: data?.downloads ?? 0,
      icon: Download,
    },
    {
      label: "Bookmarks",
      value: data?.bookmarks ?? 0,
      icon: BookMarked,
    },
    {
      label: "Storage",
      value: formatStorage(data?.storage ?? 0),
      icon: HardDrive,
    },
  ];

  const pendingCount = data?.pending ?? 0;

  return (
    <section className="space-y-5 sm:space-y-6">
    {/* Pending approvals */}
      <div
        className={`flex items-center justify-between gap-3 rounded-sm border p-3.5 sm:gap-4 sm:p-5 ${
          pendingCount > 0
            ? "border-gold/40 bg-gold/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border sm:h-9 sm:w-9 ${
              pendingCount > 0
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold sm:text-sm">
              Pending Approval
            </p>

            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
              User accounts and resources awaiting administrative review.
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 font-display text-xl font-semibold sm:text-2xl ${
            pendingCount > 0
              ? "text-gold"
              : "text-foreground"
          }`}
        >
          {pendingCount}
        </span>
      </div>
      
      {/* Primary statistics */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border min-[820px]:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className={`group flex min-h-6 flex-col justify-between bg-card p-3 sm:min-h-6 sm:p-3 ${
                index > 0 ? "border-border" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2.5 sm:gap-3">
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-xs sm:tracking-[0.12em]">
                  {stat.label}
                </span>

                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:scale-105 sm:h-4 sm:w-4" />
              </div>

              <div
                className={`mt-4 font-display font-semibold tracking-tight sm:mt-6 ${
                  stat.label === "Storage"
                    ? "text-1xl sm:text-1xl"
                    : "text-1xl sm:text-1xl"
                }`}
              >
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}