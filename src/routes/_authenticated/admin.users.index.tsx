import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  History,
  Loader2,
  Search,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  type AccountStatus,
  type AppRole,
} from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute(
  "/_authenticated/admin/users/",
)({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
        },
      });
    }

    const { data: profile } =
      await supabase
        .from("private_profiles")
        .select("primary_role")
        .eq("id", session.user.id)
        .single();

    if (
      !profile ||
      !profile.primary_role ||
      !["admin", "co-admin"].includes(
        profile.primary_role,
      )
    ) {
      throw redirect({
        to: "/admin",
      });
    }
  },

  component: UsersPage,
});

const PAGE_SIZE = 20;

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateDisplay(value: string): string {
  const date = parseDateValue(value);

  if (!date) return "DD/MM/YYYY";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const STATUSES: AccountStatus[] = [
  "active",
  "rejected",
  "suspended",
  "inactive",
];

const ROLES: AppRole[] = [
  "guest",
  "student",
  "lecturer",
  "researcher",
  "staff",
  "co-admin",
  "admin",
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

type UserPresence = {
  user_id: string;
  last_seen_at: string;
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
};

type ActorProfile = {
  id: string;
  full_name: string | null;
};

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
    subscription_started_at:
      row.subscription_started_at,
    subscription_expires_at:
      row.subscription_expires_at,
  };
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function getStatusTextColor(status: AccountStatus) {
  switch (status) {
    case "active":
      return "text-green-600 dark:text-green-400";

    case "pending":
      return "text-amber-600 dark:text-amber-400";

    case "suspended":
      return "text-gold";

    case "rejected":
      return "text-red-600 dark:text-red-400";

    case "inactive":
    default:
      return "text-muted-foreground";
  }
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function formatLastActivity(
  value: string | null | undefined,
) {
  if (!value) {
    return "Never active";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never active";
  }

  const elapsed = Math.max(
    0,
    Date.now() - date.getTime(),
  );

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    } ago`;
  }

  if (hours < 24) {
    return `${hours} ${
      hours === 1 ? "hour" : "hours"
    } ago`;
  }

  if (days < 7) {
    return `${days} ${
      days === 1 ? "day" : "days"
    } ago`;
  }

  return formatDate(value);
}

function getInitials(
  fullName: string,
) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function getRoleIcon(
  role: AppRole,
) {
  if (
    role === "student" ||
    role === "lecturer" ||
    role === "researcher"
  ) {
    return GraduationCap;
  }

  if (
    role === "admin" ||
    role === "co-admin" ||
    role === "staff"
  ) {
    return Shield;
  }

  return UserRound;
}

function getActorLabel(
  performedBy: string | null | undefined,
  actorMap: Map<string, string>,
) {
  if (!performedBy) {
    return "System / SQL Editor";
  }

  return (
    actorMap.get(performedBy) ??
    "Unknown user"
  );
}

function getAuditChange(
  log: UserAuditLog,
) {
  let oldValue: unknown;
  let newValue: unknown;

  if (log.action === "role_changed") {
    oldValue = log.old_data?.primary_role;
    newValue = log.new_data?.primary_role;
  } else if (
    log.action === "status_changed"
  ) {
    oldValue = log.old_data?.status;
    newValue = log.new_data?.status;
  }

  if (
    typeof oldValue === "string" &&
    typeof newValue === "string"
  ) {
    return `${formatLabel(oldValue)} → ${formatLabel(
      newValue,
    )}`;
  }

  return "Change recorded";
}

function getAuditActionLabel(
  action: string,
) {
  switch (action) {
    case "role_changed":
      return "Role changed";

    case "status_changed":
      return "Status changed";

    default:
      return formatLabel(action);
  }
}

function UsersPage() {
  const navigate = useNavigate();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  /*
   * Online presence is visible only to admins
   * and co-admins on the Users page.
   */
  const canViewUserPresence =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [roleFilter, setRoleFilter] =
    useState("all");

  const [presenceFilter, setPresenceFilter] =
    useState<"all" | "online" | "offline">("all");

  const [sort, setSort] = useState<
    "newest" |
    "oldest" |
    "alphabetical"
  >("newest");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [page, setPage] = useState(1);

  const searchTopRef =
    useRef<HTMLDivElement>(null);

  const previousPageRef = useRef(page);
  const pendingScrollRef = useRef(false);

  const [
    expandedHistoryUserId,
    setExpandedHistoryUserId,
  ] = useState<string | null>(null);

  /*
   * Keep the currently open Users page
   * synchronized with the authenticated
   * user's permissions.
   */
  useEffect(() => {
    const stillHasUserManagementAccess =
      roles?.includes("admin") ||
      roles?.includes("co-admin");

    if (
      currentUser &&
      roles &&
      !stillHasUserManagementAccess
    ) {
      toast.error(
        "Your account no longer has permission to access Users.",
      );

      navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [
    currentUser,
    roles,
    navigate,
  ]);

  const {
    data,
    isLoading,
    isError,
  } = useQuery<UserProfile[]>({
    queryKey: ["admin-users"],

    queryFn: async () => {
      const { data, error } =
        await supabase
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
          .neq("status", "pending")
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) =>
        mapUserProfile(
          row as unknown as ProfileQueryRow,
        ),
      );
    },
  });

  /*
   * Retrieve online users through the existing secured RPC.
   * The database authorizes access to admins and co-admins.
   */
  const {
    data: onlineUsers = [],
  } = useQuery<UserPresence[]>({
    queryKey: ["admin-online-users"],

    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_library_online_users",
      );

      if (error) {
        throw error;
      }

      return (data ?? []) as UserPresence[];
    },

    enabled:
      canViewUserPresence &&
      !!currentUser &&
      !isLoading &&
      !isError,

    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  /*
   * Retrieve the latest presence timestamp for all users.
   * This uses the separate secured RPC and does not
   * access the private.user_presence table directly.
   */
  const {
    data: userPresence = [],
  } = useQuery<UserPresence[]>({
    queryKey: ["admin-user-presence"],

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      ).rpc("get_library_user_presence");

      if (error) {
        throw error;
      }

      return (data ?? []) as UserPresence[];
    },

    enabled:
      canViewUserPresence &&
      !!currentUser &&
      !isLoading &&
      !isError,

    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const onlineUserIds = useMemo(
    () =>
      new Set(
        onlineUsers.map(
          (presence) => presence.user_id,
        ),
      ),
    [onlineUsers],
  );

  const lastSeenByUser = useMemo(() => {
    const map = new Map<string, string>();

    for (const presence of userPresence) {
      map.set(
        presence.user_id,
        presence.last_seen_at,
      );
    }

    return map;
  }, [userPresence]);

  const {
    data: auditLogs,
    isLoading: auditLogsLoading,
  } = useQuery<UserAuditLog[]>({
    queryKey: ["admin-user-audits"],
    staleTime: 60_000,

    queryFn: async () => {
      const { data, error } =
        await supabase
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
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as UserAuditLog[];
    },
  });

  const actorIds = useMemo(() => {
    return Array.from(
      new Set(
        (auditLogs ?? [])
          .map(
            (log) => log.performed_by,
          )
          .filter(Boolean),
      ),
    );
  }, [auditLogs]);

  const {
    data: actorProfiles,
  } = useQuery<ActorProfile[]>({
    queryKey: [
      "admin-user-audit-actors",
      actorIds,
    ],

    enabled: actorIds.length > 0,

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("private_profiles")
          .select("id, full_name")
          .in("id", actorIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as ActorProfile[];
    },
  });

  const actorMap = useMemo(() => {
    const map = new Map<string, string>();

    for (
      const actor of
        (actorProfiles ?? []).filter(
          (
            actor,
          ): actor is {
            id: string;
            full_name: string | null;
          } => Boolean(actor.id),
        )
    ) {
      if (actor.full_name?.trim()) {
        map.set(
          actor.id,
          actor.full_name.trim(),
        );
      }
    }

    return map;
  }, [actorProfiles]);

  const auditByUser = useMemo(() => {
    const map = new Map<
      string,
      UserAuditLog[]
    >();

    for (const log of auditLogs ?? []) {
      const existing =
        map.get(log.user_id) ?? [];

      existing.push(log);
      map.set(
        log.user_id,
        existing,
      );
    }

    return map;
  }, [auditLogs]);

  const filteredUsers = useMemo(() => {
    const users = data ?? [];

    const query = search
      .trim()
      .toLowerCase();

    const filtered = users.filter((user) => {
      const matchesSearch =
        !query ||
        user.full_name
          .toLowerCase()
          .includes(query) ||
        user.email
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        user.status === statusFilter;

      const matchesRole =
        roleFilter === "all" ||
        user.primary_role === roleFilter;

      const isOnline = onlineUserIds.has(user.id);

      const matchesPresence =
        presenceFilter === "all" ||
        (presenceFilter === "online" && isOnline) ||
        (presenceFilter === "offline" && !isOnline);

      const createdAt = new Date(
        user.created_at,
      );

      const createdDateKey =
        Number.isNaN(createdAt.getTime())
          ? null
          : `${createdAt.getFullYear()}-${String(
              createdAt.getMonth() + 1,
            ).padStart(2, "0")}-${String(
              createdAt.getDate(),
            ).padStart(2, "0")}`;

      const matchesDateFrom =
        !dateFrom ||
        (
          createdDateKey !== null &&
          createdDateKey >= dateFrom
        );

      const matchesDateTo =
        !dateTo ||
        (
          createdDateKey !== null &&
          createdDateKey <= dateTo
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole &&
        matchesPresence &&
        matchesDateFrom &&
        matchesDateTo
      );
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "alphabetical":
          return a.full_name.localeCompare(
            b.full_name,
            undefined,
            {
              sensitivity: "base",
            },
          );

        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });

    return filtered;
  }, [
    data,
    search,
    statusFilter,
    roleFilter,
    presenceFilter,
    sort,
    dateFrom,
    dateTo,
    onlineUserIds,
  ]);

  /*
   * Reset pagination when search, filters,
   * or sort order changes.
   */
  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    roleFilter,
    presenceFilter,
    sort,
    dateFrom,
    dateTo,
  ]);

  /*
   * Remember page changes so scrolling
   * occurs after React commits the update.
   */
  useEffect(() => {
    if (previousPageRef.current === page) {
      return;
    }

    previousPageRef.current = page;
    pendingScrollRef.current = true;
  }, [page]);

  /*
   * Scroll to the search field after a page
   * change. Waiting for the next animation
   * frame helps ensure the target is mounted.
   */
  useEffect(() => {
    if (!pendingScrollRef.current) {
      return;
    }

    const target = searchTopRef.current;

    if (!target) {
      return;
    }

    pendingScrollRef.current = false;

    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [page]);

  const currentUserIsAdmin =
    roles?.includes("admin");

  const canModifyUser = (
    target: UserProfile,
  ) => {
    if (!currentUser) {
      return false;
    }

    if (
      currentUser.id === target.id
    ) {
      return false;
    }

    if (
      !currentUserIsAdmin &&
      target.primary_role === "admin"
    ) {
      return false;
    }

    return true;
  };

  const toggleHistory = (
    userId: string,
  ) => {
    setExpandedHistoryUserId(
      (current) =>
        current === userId
          ? null
          : userId,
    );
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    roleFilter !== "all" ||
    presenceFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sort !== "newest";

  const totalCount = filteredUsers.length;

  const totalPages = Math.ceil(
    totalCount / PAGE_SIZE,
  );

  const firstResult =
    totalCount === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const lastResult = Math.min(
    page * PAGE_SIZE,
    totalCount,
  );

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredUsers.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredUsers, page]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRoleFilter("all");
    setPresenceFilter("all");
    setSort("newest");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <>
      <div className="w-full space-y-4 sm:space-y-5">
        {/* Filters */}
        <div
          ref={searchTopRef}
          className="scroll-mt-21 rounded-sm border border-border bg-card p-3.5 shadow-soft sm:p-5"
        >
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_170px_170px]">
            {/* Search */}
            <div className="relative col-span-2 min-w-0 lg:col-span-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by name or email..."
                className="h-9 pl-8 text-xs sm:h-10 sm:pl-9 sm:text-sm"
              />
            </div>

            {/* Status */}
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All statuses
                </SelectItem>

                {STATUSES.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                  >
                    {formatLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role */}
            <Select
              value={roleFilter}
              onValueChange={setRoleFilter}
            >
              <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All roles
                </SelectItem>

                {ROLES.map((role) => (
                  <SelectItem
                    key={role}
                    value={role}
                  >
                    {formatLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Presence */}
            {canViewUserPresence && (
              <Select
                value={presenceFilter}
                onValueChange={(value) =>
                  setPresenceFilter(value as typeof presenceFilter)
                }
              >
                <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm">
                  <SelectValue placeholder="All presence" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Sort */}
            <div className="min-w-0">
              <Select
                value={sort}
                onValueChange={(value) =>
                  setSort(value as typeof sort)
                }
              >
                <SelectTrigger
                  id="users-sort"
                  className="h-9 w-full min-w-0 px-3 text-xs sm:h-10 sm:text-sm"
                >
                  <SelectValue placeholder="Sort users" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="alphabetical">Alphabetically</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="min-w-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full min-w-0 bg-card justify-between px-2 text-xs font-normal sm:text-sm"
                  >
                    <span
                      className={
                        dateFrom
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {formatDateDisplay(dateFrom)}
                    </span>

                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={parseDateValue(dateFrom)}
                    onSelect={(date) => {
                      if (date) {
                        setDateFrom(formatDateValue(date));
                      }
                    }}
                    disabled={
                      dateTo
                        ? { after: parseDateValue(dateTo)! }
                        : undefined
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date to */}
            <div className="min-w-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full min-w-0 bg-card justify-between px-2 text-xs font-normal sm:text-sm"
                  >
                    <span
                      className={
                        dateTo
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {formatDateDisplay(dateTo)}
                    </span>

                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-auto p-0"
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={parseDateValue(dateTo)}
                    onSelect={(date) => {
                      if (date) {
                        setDateTo(formatDateValue(date));
                      }
                    }}
                    disabled={
                      dateFrom
                        ? { before: parseDateValue(dateFrom)! }
                        : undefined
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Result count and clear filters */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="pl-1 text-xs text-gold sm:text-sm">
                {isLoading ? (
                  "Loading users..."
                ) : isError ? (
                  "Unable to load users"
                ) : totalCount === 0 ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-gold">
                      0
                    </span>{" "}
                    users
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-gold">
                      {firstResult}–{lastResult}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gold">
                      {totalCount}
                    </span>{" "}
                    {totalCount === 1 ? "user" : "users"}
                  </>
                )}
              </p>
            </div>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 shrink-0 px-2 text-xs text-gold sm:h-8"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {canViewUserPresence &&
          !isLoading &&
          !isError && (
            <p
              className="mb-3 ml-5 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm"
              aria-live="polite"
            >
              <span>
                <span className="font-semibold text-muted-foreground">
                  {onlineUserIds.size}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-muted-foreground">
                  {(data ?? []).filter(
                    (user) => user.status === "active",
                  ).length}
                </span>{" "}
                active users online
              </span>

              <span
                className="h-3 w-3 shrink-0 rounded-full bg-green-500 animate-pulse"
                aria-label="Online"
                title="Online"
              />
            </p>
          )}

        {/* User table */}
        <div className="rounded-1xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-background scrollbar-track-background">
            <table className="w-full min-w-[1100px] text-xs sm:text-sm">
              <thead className="border-b border-border text-left text-[9px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                <tr>
                  <th className="w-10 p-3 text-center font-medium sm:p-4">
                    #
                  </th>

                  <th className="p-3 !pl-5 font-medium sm:p-4 sm:!pl-5">
                    User
                  </th>

                  <th className="p-3 !pl-5.5 font-medium sm:p-4 sm:!pl-5.5">
                    Role
                  </th>

                  <th className="p-3 !pl-5.5 font-medium sm:p-4 sm:!pl-5.5">
                    Status
                  </th>

                  <th className="p-3 !pl-5.5 font-medium sm:p-4 sm:!pl-5.5">
                    Plan
                  </th>

                  <th className="p-3 !pl-5.5 font-medium sm:p-4 sm:!pl-5.5">
                    Joined
                  </th>

                  <th className="p-3 !pl-5.5 font-medium sm:p-4 sm:!pl-5.5">
                    Last Activity
                  </th>

                  <th className="p-3 text-center font-medium sm:p-4">
                    History
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm"
                    >
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                        Loading users...
                      </div>
                    </td>
                  </tr>
                )}

                {isError && !isLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-xs text-destructive sm:p-10 sm:text-sm"
                    >
                      Failed to load users.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !isError &&
                  filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm"
                      >
                        {data?.length
                          ? "No users match your search or filters."
                          : "No users found."}
                      </td>
                    </tr>
                  )}

                {!isLoading &&
                  !isError &&
                  paginatedUsers.map((user, index) => {
                    const serialNumber =
                      (page - 1) * PAGE_SIZE + index + 1;

                    const isSelf =
                      currentUser?.id === user.id;

                    const canModify =
                      canModifyUser(user);

                    const canOpenDetails =
                      canModify;

                    const RoleIcon =
                      getRoleIcon(user.primary_role);

                    const isOnline =
                      onlineUserIds.has(user.id);

                    const lastSeenAt =
                      lastSeenByUser.get(user.id);

                    const userHistory =
                      auditByUser.get(user.id) ?? [];

                    const historyOpen =
                      expandedHistoryUserId === user.id;

                    return (
                      <Fragment key={user.id}>
                        <tr className="transition-colors hover:bg-muted/30">
                          <td className="p-3 text-center text-[10px] font-medium text-muted-foreground sm:p-4 sm:text-xs">
                            {serialNumber}
                          </td>

                          <td className="p-3 sm:p-4">
                            {canOpenDetails ? (
                              <Link
                                to="/admin/users/$userId"
                                params={{
                                  userId: user.id,
                                }}
                                className="group flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-3"
                              >
                                <div className="relative h-8 w-8 shrink-0 sm:h-9 sm:w-9">
                                  {user.avatar_url ? (
                                    <img
                                      src={user.avatar_url}
                                      alt={user.full_name}
                                      className="h-full w-full rounded-full border border-border object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-[10px] font-semibold sm:text-xs">
                                      {getInitials(
                                        user.full_name || "User",
                                      )}
                                    </div>
                                  )}

                                  {canViewUserPresence && (
                                    <span
                                      role="img"
                                      aria-label={
                                        isOnline
                                          ? "Online"
                                          : "Offline"
                                      }
                                      title={
                                        isOnline
                                          ? "Online"
                                          : "Offline"
                                      }
                                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card sm:h-3 sm:w-3 ${
                                        isOnline
                                          ? "bg-green-500"
                                          : "bg-gray-400"
                                      }`}
                                    />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="font-medium transition-colors group-hover:text-muted-foreground">
                                    {user.full_name ||
                                      "Unnamed user"}

                                    {isSelf && (
                                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground sm:ml-2 sm:text-xs">
                                        (You)
                                      </span>
                                    )}
                                  </div>

                                  <div className="max-w-[220px] truncate text-[10px] text-muted-foreground sm:max-w-none sm:text-xs">
                                    {user.email || "—"}
                                  </div>
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="relative h-8 w-8 shrink-0 sm:h-9 sm:w-9">
                                  {user.avatar_url ? (
                                    <img
                                      src={user.avatar_url}
                                      alt={user.full_name}
                                      className="h-full w-full rounded-full border border-border object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-[10px] font-semibold sm:text-xs">
                                      {getInitials(
                                        user.full_name || "User",
                                      )}
                                    </div>
                                  )}

                                  {canViewUserPresence && (
                                    <span
                                      role="img"
                                      aria-label={
                                        isOnline
                                          ? "Online"
                                          : "Offline"
                                      }
                                      title={
                                        isOnline
                                          ? "Online"
                                          : "Offline"
                                      }
                                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card sm:h-3 sm:w-3 ${
                                        isOnline
                                          ? "bg-green-500"
                                          : "bg-gray-400"
                                      }`}
                                    />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="font-medium">
                                    {user.full_name ||
                                      "Unnamed user"}

                                    {isSelf && (
                                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground sm:ml-2 sm:text-xs">
                                        (You)
                                      </span>
                                    )}
                                  </div>

                                  <div className="max-w-[220px] truncate text-[10px] text-muted-foreground sm:max-w-none sm:text-xs">
                                    {user.email || "—"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Read-only Role */}
                          <td className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:gap-2 sm:text-sm">
                              <RoleIcon className="h-3 w-3 shrink-0 text-muted-foreground sm:h-3.5 sm:w-3.5" />

                              <span>
                                {formatLabel(user.primary_role)}
                              </span>
                            </div>
                          </td>

                          {/* Read-only Status */}
                          <td className="p-3 sm:p-4">
                            <span
                              className={`whitespace-nowrap text-xs font-medium sm:text-sm ${getStatusTextColor(
                                user.status,
                              )}`}
                            >
                              {formatLabel(user.status)}
                            </span>
                          </td>

                          {/* Subscription Plan */}
                          <td className="p-3 sm:p-4">
                            <span
                              className={`whitespace-nowrap text-xs font-medium sm:text-sm ${
                                user.subscription_plan === "premium"
                                  ? "text-gold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatLabel(
                                user.subscription_plan,
                              )}
                            </span>
                          </td>

                          {/* Joined */}
                          <td className="whitespace-nowrap p-3 text-muted-foreground sm:p-4">
                            {formatDate(user.created_at)}
                          </td>

                          {/* Last Activity */}
                          <td className="p-3 sm:p-4">
                            {canViewUserPresence ? (
                              isOnline ? (
                                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-green-600 dark:text-green-400 sm:text-sm">
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                                  Online
                                </span>
                              ) : (
                                <span
                                  className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm"
                                  title={
                                    lastSeenAt
                                      ? formatDateTime(lastSeenAt)
                                      : undefined
                                  }
                                >
                                  {formatLastActivity(lastSeenAt)}
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground sm:text-sm">
                                —
                              </span>
                            )}
                          </td>

                          {/* History */}
                          <td className="p-3 text-center sm:p-4">
                            <div className="flex items-center justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[10px] text-muted-foreground sm:h-9 sm:px-2.5 sm:text-xs"
                                onClick={() =>
                                  toggleHistory(user.id)
                                }
                              >
                                <History className="mr-1 h-3 w-3 text-muted-foreground sm:mr-1.5 sm:h-3.5 sm:w-3.5" />

                                {historyOpen ? (
                                  <>
                                    Hide history
                                    <ChevronUp className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-3.5 sm:w-3.5" />
                                  </>
                                ) : (
                                  <>
                                    History ({userHistory.length})
                                    <ChevronDown className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-3.5 sm:w-3.5" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {historyOpen && (
                          <tr className="bg-muted/10">
                            <td
                              colSpan={8}
                              className="p-0"
                            >
                              <div className="border-t border-border px-3.5 py-3.5 sm:px-6 sm:py-4">
                                <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                                  <div>
                                    <h4 className="text-xs font-semibold sm:text-sm">
                                      User history
                                    </h4>

                                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                                      Role and account-status changes recorded for this user.
                                    </p>
                                  </div>
                                </div>

                                {auditLogsLoading ? (
                                  <div className="flex items-center gap-1.5 py-5 text-xs text-muted-foreground sm:gap-2 sm:py-6 sm:text-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                                    Loading history...
                                  </div>
                                ) : userHistory.length === 0 ? (
                                  <div className="py-5 text-xs text-muted-foreground sm:py-6 sm:text-sm">
                                    No account changes have been recorded for this user.
                                  </div>
                                ) : (
                                  <div className="space-y-2.5 sm:space-y-3">
                                    {userHistory.map((log) => (
                                      <div
                                        key={log.id}
                                        className="border-l-2 border-border pl-3 sm:pl-4"
                                      >
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                          <div>
                                            <div className="text-xs font-medium sm:text-sm">
                                              {getAuditActionLabel(
                                                log.action,
                                              )}
                                            </div>

                                            <div className="text-[10px] text-muted-foreground sm:text-xs">
                                              {getAuditChange(log)}
                                            </div>
                                          </div>

                                          <div className="text-[10px] text-muted-foreground sm:text-right sm:text-xs">
                                            {formatDateTime(
                                              log.created_at,
                                            )}
                                          </div>
                                        </div>

                                        <div className="mt-1.5 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
                                          By{" "}
                                          <span className="font-medium text-foreground">
                                            {getActorLabel(
                                              log.performed_by,
                                              actorMap,
                                            )}
                                          </span>
                                        </div>

                                        <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">
                                          Reason:{" "}
                                          <span className="text-foreground">
                                            {log.reason || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!isLoading &&
          !isError &&
          totalCount > 0 &&
          totalPages > 1 && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-3 items-center gap-2">
                {/* Previous: far left */}
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                    className="h-9 text-xs sm:text-sm"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                </div>

                {/* Page indicator: exact center */}
                <span className="whitespace-nowrap text-center text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>

                {/* Next: far right */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      page >= totalPages || isLoading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          totalPages,
                          current + 1,
                        ),
                      )
                    }
                    className="h-9 text-xs sm:text-sm"
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
      </div>
    </>
  );
}