import { createFileRoute, redirect, useNavigate, Link, } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Download, FileText, History, Loader2, Mail, ShieldCheck, Shield, UserRound, Upload, RefreshCw, Activity, CircleCheck, CircleX, Microscope, NotebookPen, UserRoundSearch, Presentation, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  type AccountStatus,
  type AppRole,
} from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getContributorLevel, getLevelProgress, getNextContributorLevel } from "@/lib/reputation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute(
  "/_authenticated/admin/users/$userId",
)({
  beforeLoad: async () => {
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
        },
      });
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("private_profiles")
      .select("primary_role, status")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }

    if (
      !profile.primary_role ||
      !["admin", "co-admin"].includes(
        profile.primary_role,
      )
    ) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }

    if (profile.status !== "active") {
      const targetPath =
        profile.status === "pending"
          ? "/pending"
          : profile.status === "suspended"
            ? "/suspended"
            : profile.status === "rejected"
              ? "/rejected"
              : profile.status === "inactive"
                ? "/inactive"
                : "/pending";

      throw redirect({
        to: targetPath,
        replace: true,
      });
    }
  },

  component: UserDetailsPage,
});

const STATUSES: AccountStatus[] = [
  "active",
  "rejected",
  "suspended",
  "inactive",
];

const ROLES: AppRole[] = [
  "admin",
  "co-admin",
  "staff",
  "lecturer",
  "researcher",
  "student",
  "guest",
];

type DatabaseAppRole =
  Database["public"]["Enums"]["app_role"];

type SubscriptionPlan =
  Database["public"]["Enums"]["subscription_plan"];

type ProfileQueryRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  primary_role: DatabaseAppRole;
  status: AccountStatus;
  reputation: number;
  created_at: string;
  updated_at: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  primary_role: AppRole;
  status: AccountStatus;
  reputation: number;
  created_at: string;
  updated_at: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
};

type ResourceRow = {
  id: string;
  title: string | null;
  description: string | null;
  file_name: string | null;
  file_size: number | null;
  download_count: number | null;
  created_at: string;
  status: string | null;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  created_at: string;
};

type UserAuditLog = {
  id: string;
  user_id: string;
  performed_by: string;
  action: string;
  reason: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
};

type UserPresence = {
  user_id: string;
  last_seen_at: string;
};

type PendingAction =
  | {
      type: "status";
      value: AccountStatus;
    }
  | {
      type: "role";
      value: AppRole;
    }
  | null;

function mapUserProfile(
  row: ProfileQueryRow,
): UserProfile {
  return {
    id: row.id,
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    avatar_url: row.avatar_url,
    bio: row.bio,
    phone_number: row.phone_number,
    college: row.college,
    department: row.department,
    level: row.level,
    primary_role: row.primary_role as AppRole,
    status: row.status,
    reputation: row.reputation,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subscription_plan: row.subscription_plan,
    subscription_status: row.subscription_status,
    subscription_started_at: row.subscription_started_at,
    subscription_expires_at: row.subscription_expires_at,
  };
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) return "Never recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLastActivity(
  value: string | null | undefined,
) {
  if (!value) return "Never active";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never active";
  }

  const elapsed = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return formatDate(value);
}

function formatFileSize(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    value <= 0
  ) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "U";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRoleIcon(role: AppRole) {
  switch (role) {
    case "admin":
      return ShieldCheck;

    case "co-admin":
      return Shield;

    case "staff":
      return ClipboardList;

    case "lecturer":
      return Presentation;

    case "researcher":
      return Microscope;

    case "student":
      return NotebookPen;

    case "guest":
      return UserRoundSearch;

    default:
      return UserRound;
  }
}

function getRoleLabel(role: AppRole) {
  switch (role) {
    case "admin":
      return "Administrator";
    case "co-admin":
      return "Co-admin";
    case "lecturer":
      return "Lecturer";
    case "staff":
      return "Staff";
    case "student":
      return "Student";
    case "researcher":
      return "Researcher";
    case "guest":
      return "Guest";
    default:
      return formatLabel(role);
  }
}

function getUserStatusStyles(status: string) {
  switch (status) {
    case "active":
      return "text-green-500";

    case "suspended":
      return "bg-gold text-gold dark:text-gold";

    case "rejected":
      return "bg-destructive/10 text-destructive";

    case "inactive":
      return "bg-muted-foreground/10 text-muted-foreground";

    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

function getResourceStatusStyles(status: string) {
  switch (status) {
    case "approved":
      return "text-green-600 dark:text-green-400";

    case "pending":
      return "text-amber-600 dark:text-amber-400";

    case "draft":
      return "text-muted-foreground";

    case "rejected":
    case "deleted":
      return "text-destructive";

    default:
      return "text-muted-foreground";
  }
}

function getAuditChange(log: UserAuditLog) {
  let oldValue: unknown;
  let newValue: unknown;

  if (log.action === "role_changed") {
    oldValue = log.old_data?.primary_role;
    newValue = log.new_data?.primary_role;
  } else if (log.action === "status_changed") {
    oldValue = log.old_data?.status;
    newValue = log.new_data?.status;
  }

  if (
    typeof oldValue === "string" &&
    typeof newValue === "string"
  ) {
    return `${formatLabel(oldValue)} → ${formatLabel(newValue)}`;
  }

  return "Change recorded";
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case "role_changed":
      return "Role changed";

    case "status_changed":
      return "Status changed";

    default:
      return formatLabel(action);
  }
}

function UserDetailsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  const { userId } = Route.useParams();

  const [pendingAction, setPendingAction] =
    useState<PendingAction>(null);

  const [actionReason, setActionReason] =
    useState("");

  const [showHistory, setShowHistory] =
    useState(false);

  const [showAllResources, setShowAllResources] =
    useState(false);

  const currentUserIsAdmin =
    roles?.includes("admin") ?? false;

  const hasAdminAccess =
    Boolean(
      roles?.includes("admin") ||
      roles?.includes("co-admin"),
    );

  useEffect(() => {
    if (!currentUser || !roles) return;

    if (
      !roles.includes("admin") &&
      !roles.includes("co-admin")
    ) {
      void navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [currentUser, roles, navigate]);

  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
    refetch: refetchUser,
  } = useQuery<UserProfile | null>({
    queryKey: ["admin-user-details", userId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_profiles")
        .select(
          [
            "id",
            "full_name",
            "email",
            "avatar_url",
            "bio",
            "phone_number",
            "college",
            "department",
            "level",
            "primary_role",
            "status",
            "reputation",
            "created_at",
            "updated_at",
            "subscription_plan",
            "subscription_status",
            "subscription_started_at",
            "subscription_expires_at",
          ].join(", "),
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapUserProfile(
        data as unknown as ProfileQueryRow,
      );
    },
    enabled: hasAdminAccess,
  });

  // Uses the same online-presence RPC and cache key as the Admin Users page.
  const {
    data: onlineUsers = [],
    isLoading: onlineUsersLoading,
  } = useQuery<UserPresence[]>({
    queryKey: ["admin-online-users"],

    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_library_online_users",
      );

      if (error) throw error;

      return (data ?? []) as UserPresence[];
    },

    enabled: hasAdminAccess && !!userId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // Uses the same last-seen RPC and cache key as the Admin Users page.
  const {
    data: userPresence = [],
    isLoading: userPresenceLoading,
  } = useQuery<UserPresence[]>({
    queryKey: ["admin-user-presence"],

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      ).rpc("get_library_user_presence");

      if (error) throw error;

      return (data ?? []) as UserPresence[];
    },

    enabled: hasAdminAccess && !!userId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: resources,
    isLoading: resourcesLoading,
  } = useQuery<ResourceRow[]>({
    queryKey: ["admin-user-resources", userId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(
          [
            "id",
            "title",
            "description",
            "file_name",
            "file_size",
            "download_count",
            "created_at",
            "status",
          ].join(", "),
        )
        .eq("uploader_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []) as unknown as ResourceRow[];
    },

    enabled: hasAdminAccess && !!userId,
  });

  const {
    data: auditHistory,
    isLoading: auditHistoryLoading,
  } = useQuery<UserAuditLog[]>({
    queryKey: ["admin-user-audits", userId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_audit_logs")
        .select(
          [
            "id",
            "user_id",
            "performed_by",
            "action",
            "reason",
            "old_data",
            "new_data",
            "created_at",
          ].join(", "),
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      const logs = (data ?? []) as unknown as UserAuditLog[];

      if (logs.length === 0) return [];

      const actorIds = Array.from(
        new Set(logs.map((log) => log.performed_by)),
      );

      const {
        data: actors,
        error: actorsError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name")
        .in("id", actorIds);

      if (actorsError) throw actorsError;

      const actorMap = new Map<string, string>();

      for (
        const actor of (actors ?? []).filter(
          (
            actor,
          ): actor is {
            id: string;
            full_name: string | null;
          } => Boolean(actor.id),
        )
      ) {
        actorMap.set(
          actor.id,
          actor.full_name ?? "Unknown user",
        );
      }

      return logs.map((log) => ({
        ...log,
        actor_name:
          actorMap.get(log.performed_by) ?? "Unknown user",
      }));
    },

    enabled: hasAdminAccess && !!userId,
  });

  const isOnline = onlineUsers.some(
    (presence) => presence.user_id === userId,
  );

  const lastSeenAt =
    userPresence.find(
      (presence) => presence.user_id === userId,
    )?.last_seen_at ?? null;

  const presenceLoading =
    onlineUsersLoading || userPresenceLoading;

  const lastActivityText = presenceLoading
    ? "Checking activity..."
    : isOnline
      ? "Online"
      : formatLastActivity(lastSeenAt);

  const lastActivityDate = isOnline
    ? "Currently active"
    : lastSeenAt
      ? formatDateTime(lastSeenAt)
      : "No recorded activity for this account";

  const approvedResources = useMemo(
    () =>
      (resources ?? []).filter(
        (resource) => resource.status === "approved",
      ),
    [resources],
  );

  const contributor = getContributorLevel(
    user?.reputation ?? 0,
  );

  const progress = getLevelProgress(
    user?.reputation ?? 0,
  );

  const nextLevel = getNextContributorLevel(
    user?.reputation ?? 0,
  );

  const totalDownloads = useMemo(
    () =>
      (resources ?? []).reduce(
        (sum, resource) =>
          sum + (resource.download_count ?? 0),
        0,
      ),
    [resources],
  );

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    if (user?.created_at) {
      items.push({
        id: "registration",
        title: "Account registered",
        description: "User account was created.",
        created_at: user.created_at,
      });
    }

    if (user?.subscription_started_at) {
      items.push({
        id: "subscription-start",
        title: "Subscription started",
        description: `${formatLabel(user.subscription_plan)} plan started.`,
        created_at: user.subscription_started_at,
      });
    }

    for (const resource of resources ?? []) {
      items.push({
        id: `resource-${resource.id}`,
        title:
          resource.title ??
          resource.file_name ??
          "Resource uploaded",
        description:
          resource.status === "approved"
            ? "Resource approved."
            : "Resource submitted.",
        created_at: resource.created_at,
      });
    }

    return items
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      )
      .slice(0, 8);
  }, [user, resources]);

  const setStatus = useMutation({
    mutationFn: async ({
      status,
      reason,
    }: {
      status: AccountStatus;
      reason: string;
    }) => {
      const { error } = await supabase.rpc(
        "admin_set_user_status",
        {
          _target_user_id: userId,
          _new_status: status,
          _reason: reason,
        },
      );

      if (error) throw error;
    },

    onSuccess: (_, variables) => {
      toast.success(
        `Status changed to ${formatLabel(variables.status)}.`,
      );

      qc.invalidateQueries({
        queryKey: ["admin-user-details", userId],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-user-audits", userId],
      });

      setActionReason("");
      setPendingAction(null);
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
    },
  });

  const setRole = useMutation({
    mutationFn: async ({
      role,
      reason,
    }: {
      role: AppRole;
      reason: string;
    }) => {
      const { error } = await supabase.rpc(
        "admin_set_user_role",
        {
          _target_user_id: userId,
          _new_role: role,
          _reason: reason,
        },
      );

      if (error) throw error;
    },

    onSuccess: (_, variables) => {
      toast.success(
        `Role changed to ${formatLabel(variables.role)}.`,
      );

      qc.invalidateQueries({
        queryKey: ["admin-user-details", userId],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-user-audits", userId],
      });

      setActionReason("");
      setPendingAction(null);
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
    },
  });

  const canModifyUser = Boolean(
    currentUser &&
    user &&
    currentUser.id !== user.id &&
    (currentUserIsAdmin || user.primary_role !== "admin"),
  );

  const requestStatusChange = (status: AccountStatus) => {
    if (!user) return;

    if (!canModifyUser) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (status === user.status) return;

    setActionReason("");

    setPendingAction({
      type: "status",
      value: status,
    });
  };

  const requestRoleChange = (role: AppRole) => {
    if (!user) return;

    if (!canModifyUser) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (role === user.primary_role) return;

    if (!currentUserIsAdmin && role === "admin") {
      toast.error(
        "Co-admins cannot promote users to administrator.",
      );
      return;
    }

    setActionReason("");

    setPendingAction({
      type: "role",
      value: role,
    });
  };

  const confirmAction = () => {
    if (!pendingAction) return;

    const trimmedReason = actionReason.trim();

    if (!trimmedReason) {
      toast.error(
        "A reason is required for this change.",
      );
      return;
    }

    if (pendingAction.type === "status") {
      setStatus.mutate({
        status: pendingAction.value,
        reason: trimmedReason,
      });

      return;
    }

    setRole.mutate({
      role: pendingAction.value,
      reason: trimmedReason,
    });
  };

  const actionLoading =
    setStatus.isPending || setRole.isPending;

  if (
    currentUser &&
    roles &&
    !hasAdminAccess
  ) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading user profile...
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="mx-auto max-w-8xl space-y-5 px-1">
        <Button
          variant="ghost"
          className="-ml-2 h-9 gap-2 px-2"
          onClick={() =>
            navigate({ to: "/admin/users" })
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <CircleX className="mx-auto h-8 w-8 text-destructive" />

          <h2 className="mt-3 text-sm font-semibold">
            Unable to load user profile
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            An error occurred while retrieving this account.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void refetchUser()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-8xl space-y-5 px-1">
        <Button
          variant="ghost"
          className="-ml-2 h-9 gap-2 px-2"
          onClick={() =>
            navigate({ to: "/admin/users" })
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />

          <h2 className="mt-3 text-sm font-semibold">
            User not found
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            This account may have been removed or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const RoleIcon = getRoleIcon(user.primary_role);

  const subscriptionActive =
    user.subscription_status.toLowerCase() === "active";

  const isPremium =
    user.subscription_plan === "premium";

  return (
    <>
      <main className="mx-auto w-full max-w-8xl space-y-4 pb-8 sm:space-y-6">
        {/* Page heading */}
        <div>
          <div>
            <Button
              variant="ghost"
              className="-ml-2 h-8 gap-1.5 px-2 text-xs transition-colors hover:bg-transparent hover:text-muted-foreground sm:h-9 sm:gap-2 sm:text-sm"
              onClick={() =>
                navigate({ to: "/admin/users" })
              }
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back
            </Button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:text-xs">
              Administration
            </p>

            <h1 className="mt-1 font-display text-xl font-semibold sm:text-3xl">
              User Details
            </h1>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Account details, activity, and contribution history.
            </p>
          </div>
        </div>

        {/* Profile identity */}
<section className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
  <div className="border-b border-border bg-muted/20 p-4 sm:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      {/* Profile picture */}
      <div className="shrink-0">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.full_name || "User profile"}
            className="h-28 w-24 rounded-md border-2 border-primary/30 object-cover shadow-xl sm:h-40 sm:w-32"
          />
        ) : (
          <div className="flex h-28 w-24 items-center justify-center rounded-md border-2 border-primary/30 bg-muted text-2xl font-semibold shadow-lg sm:h-40 sm:w-32 sm:text-3xl">
            {getInitials(user.full_name || "User")}
          </div>
        )}
      </div>

      {/* Profile details */}
      <div className="min-w-0 flex-1">
        {/* Role and subscription badges */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
            <RoleIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {getRoleLabel(user.primary_role)}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
            <contributor.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {contributor.name}
        </span>

          <SubscriptionPlanBadge
            plan={user.subscription_plan}
          />
        </div>

        <h1 className="mt-3 break-words font-display text-xl font-semibold sm:mt-4 sm:text-3xl">
          {user.full_name || "Unnamed user"}
        </h1>

        {user.bio && (
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-relaxed">
            {user.bio}
          </p>
        )}

        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="break-all">
            {user.email || "No email address"}
          </span>
        </div>

        {/* Reputation and account activity */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-1.5 sm:gap-x-5">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground sm:text-sm">
            <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Joined {formatDate(user.created_at)}
          </span>

          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground sm:text-sm">
            <Clock3 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />

            <span>
              Last seen:{" "}
              <span
                className={`font-semibold ${
                  isOnline
                    ? "text-green-600 dark:text-green-400"
                    : "text-foreground"
                }`}
              >
                {lastActivityText}
              </span>

              <span className="ml-1">
                ({lastActivityDate})
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>

  {/* Profile statistics */}
  <div className="p-4 sm:p-8">
    <div className="grid grid-cols-3 text-center">
      <div className="min-w-0 px-1.5 sm:px-2">
        <div className="text-xl font-semibold sm:text-2xl">
          {resources?.length ?? 0}
        </div>

        <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
          Uploads
        </div>
      </div>

      <div className="min-w-0 border-x border-border px-1.5 sm:px-2">
        <div className="text-xl font-semibold sm:text-2xl">
          {totalDownloads.toLocaleString()}
        </div>

        <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
          Downloads
        </div>
      </div>

      <div className="min-w-0 px-1.5 sm:px-2">
        <div className="text-xl font-semibold sm:text-2xl">
          {user.reputation}
        </div>

        <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
          Reputation
        </div>
      </div>
    </div>
  </div>
</section>

        {/* Profile and administration content */}
        <div className="grid gap-4 sm:gap-6 min-[820px]:grid-cols-[minmax(0,1fr)_220px]">
          {/* Main content */}
          <main className="min-w-0 space-y-4 sm:space-y-6">
            {/* Profile information */}
            <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
              <SectionHeading
                title="Profile Information"
                description="Personal contact and academic details associated with this account."
              />

              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:mt-5 sm:grid-cols-2">
                <InfoItem
                  label="Phone number"
                  value={user.phone_number || "Not provided"}
                />

                <InfoItem
                  label="College"
                  value={user.college || "Not provided"}
                />

                <InfoItem
                  label="Department"
                  value={user.department || "Not provided"}
                />

                <InfoItem
                  label="Academic level"
                  value={user.level || "Not provided"}
                />
              </div>
            </section>

            {/* Account record */}
            <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
              <SectionHeading
                title="Account Record"
                description="Registration and profile maintenance information."
              />

              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:mt-5 sm:grid-cols-2">
                <InfoItem
                  label="Registration date"
                  value={formatDateTime(user.created_at)}
                />

                <InfoItem
                  label="Last profile update"
                  value={formatDateTime(user.updated_at)}
                />

                <InfoItem
                  label="Reputation score"
                  value={String(user.reputation)}
                />

                <InfoItem
                  label="Account identifier"
                  value={user.id}
                  mono
                />
              </div>
            </section>

            {/* Subscription */}
            <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  title="Subscription"
                  description="Current plan and subscription record."
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:mt-5 sm:grid-cols-2">
                <InfoItem
                  label="Subscription status"
                  value={formatLabel(user.subscription_status)}
                />

                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                    Plan
                  </div>

                  <p
                    className={`mt-1.5 text-xs font-semibold sm:text-sm ${
                      isPremium
                        ? "text-gold"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {formatLabel(user.subscription_plan)}
                  </p>
                </div>

                <InfoItem
                  label="Subscription started"
                  value={formatDate(user.subscription_started_at)}
                />

                <InfoItem
                  label="Subscription expires"
                  value={formatDate(user.subscription_expires_at)}
                />
              </div>

              <div className="mt-5 flex items-start gap-2.5 border-t border-border pt-4">
                {subscriptionActive ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <p className="text-xs leading-5 text-muted-foreground">
                  {subscriptionActive ? (
                    <>
                      This account currently has an active{" "}
                      <span
                        className={`font-semibold ${
                          isPremium
                            ? "text-muted-foreground"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {formatLabel(user.subscription_plan)}
                      </span>{" "}
                      subscription.
                    </>
                  ) : (
                    "This account does not currently have an active subscription."
                  )}
                </p>
              </div>
            </section>

            {/* Uploaded resources */}
            <section className="rounded-md border border-border bg-card p-3.5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  title="Uploaded Resources"
                  description="Resources submitted by this account."
                />

                <span className="shrink-0 text-xs text-muted-foreground">
                  {resources?.length ?? 0} total
                </span>
              </div>

              {resourcesLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading resources...
                </div>
              ) : resources && resources.length > 0 ? (
                <ul className="mt-4 divide-y divide-border border-y border-border">
                 {(showAllResources
  ? resources
  : resources.slice(0, 10)
).map((resource) => {
  const status = resource.status?.toLowerCase();
  const isApproved = status === "approved";

  const availabilityMessage = (() => {
    switch (status) {
      case "rejected":
        return "This resource was rejected and is unavailable for preview.";

      case "deleted":
        return "This resource has been deleted and is no longer available.";

      case "pending":
        return "This resource is awaiting approval.";

      case "draft":
        return "This resource is still a draft and has not been published.";

      default:
        return "This resource is currently unavailable for preview.";
    }
  })();

  return (
    <li key={resource.id}>
      {isApproved ? (
        <Link
          to="/preview/$resourceId"
          params={{
            resourceId: resource.id,
          }}
          className="block cursor-pointer py-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:py-4"
        >
          <div className="flex flex-col gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                {/* Resource status */}
                <p
                  className={`mb-1.5 text-[10px] font-semibold sm:text-xs ${getResourceStatusStyles(status || "unknown")}`}
                >
                  {formatLabel(status || "unknown")}
                </p>

                {/* Resource title */}
                <p className="break-words text-xs font-medium sm:text-sm">
                  {resource.title ||
                    resource.file_name ||
                    "Untitled resource"}
                </p>

                {/* Resource metadata */}
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  <span>
                    {resource.file_name || "No file name"}
                  </span>

                  <span aria-hidden="true">·</span>

                  <span>
                    {formatFileSize(resource.file_size)}
                  </span>

                  <span aria-hidden="true">·</span>

                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {(resource.download_count ?? 0).toLocaleString()} downloads
                  </span>

                  <span aria-hidden="true">·</span>

                  <span>
                    {formatDate(resource.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="cursor-default py-3 sm:py-4">
          <div className="flex flex-col gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                {/* Resource status */}
                <p
                  className={`mb-1.5 text-[10px] font-semibold sm:text-xs ${getResourceStatusStyles(status || "unknown")}`}
                >
                  {formatLabel(status || "unknown")}
                </p>

                {/* Resource title */}
                <p className="break-words text-xs font-medium sm:text-sm">
                  {resource.title ||
                    resource.file_name ||
                    "Untitled resource"}
                </p>

                {/* Resource metadata */}
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  <span>
                    {resource.file_name || "No file name"}
                  </span>

                  <span aria-hidden="true">·</span>

                  <span>
                    {formatFileSize(resource.file_size)}
                  </span>

                  <span aria-hidden="true">·</span>

                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {(resource.download_count ?? 0).toLocaleString()} downloads
                  </span>

                  <span aria-hidden="true">·</span>

                  <span>
                    {formatDate(resource.created_at)}
                  </span>
                </div>

                {/* Resource availability message */}
                <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                  {availabilityMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
})}
</ul>
              ) : (
                <div className="mt-4 border-y border-dashed border-border py-7 text-center sm:py-8">
                  <FileText className="mx-auto h-7 w-7 text-muted-foreground/60 sm:h-8 sm:w-8" />

                  <p className="mt-2.5 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                    No resources uploaded yet.
                  </p>
                </div>
              )}

              {resources && resources.length > 10 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    {showAllResources
                      ? `Showing all ${resources.length} uploaded resources.`
                      : `Showing the 10 most recent resources out of ${resources.length} total.`}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 bg-gradient-emerald text-[10px] text-white hover:bg-none hover:bg-accent hover:text-accent-foreground sm:text-xs"
                    onClick={() =>
                      setShowAllResources((value) => !value)
                    }
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    {showAllResources ? "Show less" : "View all"}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  Approved resources
                </span>

                <span className="text-sm font-semibold text-foreground">
                  {approvedResources.length}
                </span>
              </div>
            </section>

            {/* Administration audit history */}
            <section className="rounded-md border border-border bg-card p-3.5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionHeading
                  title="Administration Audit History"
                  description="Recorded administrative changes made to this account."
                />

                {auditHistory && auditHistory.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 bg-gradient-emerald text-[10px] text-white hover:bg-none hover:bg-accent hover:text-accent-foreground sm:text-xs"
                    onClick={() =>
                      setShowHistory((value) => !value)
                    }
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    {showHistory ? "Collapse" : "View history"}
                    {" "}
                    ({auditHistory.length})
                  </Button>
                )}
              </div>

              {auditHistoryLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading audit history...
                </div>
              ) : auditHistory && auditHistory.length > 0 ? (
                showHistory ? (
                  <div className="mt-5 divide-y divide-border">
                    {auditHistory.map((log) => (
                      <div
                        key={log.id}
                        className="py-4 first:pt-1 last:pb-1"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold sm:text-sm">
                              {getAuditActionLabel(log.action)}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {getAuditChange(log)}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>

                        <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
                          Performed by{" "}
                          <span className="font-medium text-foreground">
                            {log.actor_name ?? "Unknown user"}
                          </span>
                        </p>

                        <div className="mt-3 border-l-2 border-border pl-3">
                          <p className="text-[10px] leading-5 text-muted-foreground sm:text-xs">
                            <span className="font-semibold text-foreground">
                              Reason:
                            </span>{" "}
                            {log.reason || "No reason recorded."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 bg-muted/20">
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" />

                    <p className="text-xs text-muted-foreground">
                      {auditHistory.length} administrative{" "}
                      {auditHistory.length === 1 ? "change" : "changes"}{" "}
                      recorded for this account.
                    </p>
                  </div>
                )
              ) : (
                <div className="mt-4 border border-dashed border-border px-4 py-7 text-center">
                  <History className="mx-auto h-6 w-6 text-muted-foreground" />

                  <p className="mt-2 text-xs font-medium">
                    No audit records
                  </p>

                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    Administrative changes will appear here.
                  </p>
                </div>
              )}
            </section>
          </main>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-4 sm:space-y-6">
            {/* Reputation */}
            <section className="rounded-sm border border-border bg-card p-3.5 shadow-soft sm:p-6">
              <div className="flex flex-col items-start gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Reputation
                </p>
              </div>

              <div className="mb-2 flex items-center gap-2.5 sm:gap-3">
                <div>
                  <p className="inline-flex items-center gap-1 mt-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:py-1 sm:text-xs">
                    <contributor.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {contributor.name}
                  </p>

                  <p className="mt-4 text-[10px] text-muted-foreground sm:mt-3 sm:text-xs">
                    Contribution points
                  </p>

                  <span className="text-base font-semibold sm:text-md">
                    {user.reputation ?? 0}

                    <span className="ml-1 text-[10px] font-normal text-muted-foreground sm:text-xs">
                      pts
                    </span>
                  </span>
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-sm bg-muted sm:h-2">
                <div
                  className="h-full rounded-sm bg-gradient-emerald transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
  {nextLevel ? (
    <>
      {nextLevel.pointsNeeded} pts until{" "}
      {nextLevel.name}
    </>
  ) : (
    "Highest reputation level reached"
  )}
  </p>
            </section>

            {/* Account management */}
            <section className="rounded-md border border-border bg-card shadow-soft">
              <div className="flex items-center gap-2.5 border-b border-border p-4 sm:p-5">
                <div>
                  <h2 className="text-[10px] text-gold uppercase font-semibold sm:text-xs">
                    Account Management
                  </h2>

                  <p className="text-xs text-muted-foreground sm:text-xs">
                    Manage access and account permissions.
                  </p>
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold">
                    Account role
                  </label>

                  <Select
                    value={user.primary_role}
                    onValueChange={(value) =>
                      requestRoleChange(value as AppRole)
                    }
                    disabled={
                      !canModifyUser ||
                      setRole.isPending ||
                      setStatus.isPending
                    }
                  >
                    <SelectTrigger className="h-10 text-xs sm:text-xs">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ROLES.map((role) => {
                        const blockedForCoAdmin =
                          !currentUserIsAdmin &&
                          role === "admin";

                        return (
                          <SelectItem
                            key={role}
                            value={role}
                            disabled={blockedForCoAdmin}
                          >
                            {formatLabel(role)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {!currentUserIsAdmin && (
                    <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                      Co-admins cannot assign the administrator role.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold">
                    Account status
                  </label>

                  <Select
                    value={user.status}
                    onValueChange={(value) =>
                      requestStatusChange(value as AccountStatus)
                    }
                    disabled={
                      !canModifyUser ||
                      setStatus.isPending ||
                      setRole.isPending
                    }
                  >
                    <SelectTrigger
                      className={`h-10 text-xs sm:text-sm ${getUserStatusStyles(
                        user.status,
                      )
                        .split(" ")
                        .filter((className) => className.startsWith("text-"))
                        .join(" ")}`}
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          className={getUserStatusStyles(status)
                            .split(" ")
                            .filter((className) => className.startsWith("text-"))
                            .join(" ")}
                        >
                          {formatLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!canModifyUser && (
                  <p className="text-[10px] leading-5 text-muted-foreground sm:text-xs">
                    {currentUser?.id === user.id
                      ? "You cannot modify your own account from this page."
                      : "Restricted by your current administrator permissions."}
                  </p>
                )}

                {actionLoading && (
                  <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying account change...
                  </div>
                )}
              </div>
            </section>

            {/* Usage summary */}
            <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
              <SectionHeading
                title="Usage Summary"
                description="Recorded account contribution."
              />

              <div className="mt-4 space-y-4 sm:mt-5">
                <SummaryRow
                  icon={Upload}
                  label="Uploads"
                  value={(resources?.length ?? 0).toLocaleString()}
                />

                <SummaryRow
                  icon={FileText}
                  label="Approved"
                  value={approvedResources.length.toLocaleString()}
                />

                <SummaryRow
                  icon={Download}
                  label="Downloads"
                  value={totalDownloads.toLocaleString()}
                />
              </div>
            </section>

            {/* Recent activity */}
            <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
              <SectionHeading
                title="Recent Activity"
                description="Recent recorded account events."
              />

              {recentActivity.length > 0 ? (
                <div className="mt-4 space-y-4 sm:mt-5">
                  {recentActivity.map((item, index) => (
                    <div
                      key={item.id}
                      className="relative flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            index === 0
                              ? "bg-gold"
                              : "bg-muted-foreground/50"
                          }`}
                        />

                        {index !== recentActivity.length - 1 && (
                          <span className="mt-1 h-full w-px bg-border" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-xs font-semibold">
                          {item.title}
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-muted-foreground sm:text-xs">
                          {item.description}
                        </p>

                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  No recent account events recorded.
                </p>
              )}
            </section>
          </aside>
        </div>
      </main>

      {/* Reason-required confirmation dialog */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setPendingAction(null);
            setActionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Confirm account change
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm">
              {pendingAction?.type === "status" && (
                <>
                  Change{" "}
                  <strong>
                    {user.full_name || "this user"}
                  </strong>{" "}
                  from{" "}
                  <strong>
                    {formatLabel(user.status)}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formatLabel(pendingAction.value)}
                  </strong>
                  ?
                </>
              )}

              {pendingAction?.type === "role" && (
                <>
                  Change{" "}
                  <strong>
                    {user.full_name || "this user"}
                  </strong>
                  's role from{" "}
                  <strong>
                    {formatLabel(user.primary_role)}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formatLabel(pendingAction.value)}
                  </strong>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5">
            <label
              htmlFor="user-change-reason"
              className="text-xs font-semibold sm:text-sm"
            >
              Reason for this change
            </label>

            <Input
              id="user-change-reason"
              value={actionReason}
              onChange={(event) =>
                setActionReason(event.target.value)
              }
              placeholder="Enter a reason for this change..."
              disabled={actionLoading}
              autoComplete="off"
              className="h-10 text-xs sm:text-sm"
            />

            <p className="text-[10px] leading-5 text-muted-foreground sm:text-xs">
              This reason will be saved in the user audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={actionLoading}
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmAction();
              }}
              disabled={
                actionLoading ||
                !actionReason.trim()
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SubscriptionPlanBadge({
  plan,
}: {
  plan: SubscriptionPlan;
}) {
  const isPremium = plan === "premium";

  return (
    <span
      title={isPremium ? "Premium Plan" : "Free Plan"}
      aria-label={isPremium ? "Premium Plan" : "Free Plan"}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs ${
        isPremium
          ? "bg-gold/10 text-gold"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isPremium ? "Premium Account" : "Free Account"}
    </span>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:text-xs">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground sm:text-xs">
          {description}
        </p>
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon?: typeof UserRound;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span>{label}</span>
      </div>

      <p
        className={`mt-1.5 break-words text-xs font-medium sm:text-sm ${
          mono
            ? "font-mono text-[10px] text-muted-foreground sm:text-xs"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Upload;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>

      <span className="shrink-0 text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}