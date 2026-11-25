import { createFileRoute, redirect, useNavigate, } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canManageApprovals } from "@/lib/permissions";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_OPTION, colleges, getDepartments, levels, semesters } from "@/lib/academicData";
import { getResourceScopeLabel } from "@/lib/resource-scope-labels";
import { UserRound, Search, Check, CheckCircle2, Clock3, ChevronLeft, ChevronRight, Eye, FileText, Loader2, Shield, ShieldCheck, NotebookPen, UserRoundSearch, Presentation, ClipboardList, Microscope, X, XCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./dashboard";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Building2, GraduationCap, School, } from "lucide-react";
import { ResourceTypeBadge } from "@/components/ResourceTypeBadge";
import photo from "@/assets/Photo.jfif";

export const Route = createFileRoute(
  "/_authenticated/admin/approvals",
)({
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
      error,
    } = await supabase
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

    const allowed =
      canManageApprovals([
        profile.primary_role as AppRole,
      ]);

    if (!allowed) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }
  },

  head: () => ({
    meta: [
      {
        title: "Approvals | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: Approvals,
});

const PAGE_SIZE = 10;

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

type ResourceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

type ApprovalSection =
  | "users"
  | "resources";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  course_code: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  semester: string | null;
  year: number | null;
  created_at: string;
  status: ResourceStatus;
  uploader_id: string;
  category?: {
    id?: string | null;
    name?: string;
    deleted_at?: string | null;
  } | null;
  uploader?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type PendingResourcesResponse = {
  resources: Resource[];
  totalCount: number;
  pendingCount: number;
};

type PendingDecision =
  | {
      type: "approve";
      id: string;
      file_path: string;
      title: string;
    }
  | {
      type: "reject";
      id: string;
      file_path: string;
      title: string;
    };

type PendingUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: AppRole;
  college: string | null;
  department: string | null;
  level: string | null;
  created_at: string;
  status: string;
};

type PendingUserDecision = {
  type: "approve" | "reject";
  id: string;
  name: string;
  email: string;
};

function Approvals() {
  const {
    user,
    roles,
    profile,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const qc = useQueryClient();

  const canApproveUsers =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

const [activeSection, setActiveSection] =
  useState<ApprovalSection>("resources");

useEffect(() => {
  setActiveSection("resources");
}, [canApproveUsers]);

  useEffect(() => {
    if (
      loading ||
      !profile ||
      !user
    ) {
      return;
    }

    const allowed =
      canManageApprovals(
        roles ?? [],
      );

    if (!allowed) {
      toast.error(
        "Your account no longer has permission to access Approvals.",
      );

      navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [
    loading,
    profile,
    user,
    roles,
    navigate,
  ]);

  const [previewResource, setPreviewResource] =
    useState<{
      id: string;
      title: string;
      file_path: string;
    } | null>(null);

  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);

  const [decisionReason, setDecisionReason] =
    useState("");

  const [pendingUserDecision, setPendingUserDecision] =
    useState<PendingUserDecision | null>(null);

  const [userDecisionReason, setUserDecisionReason] =
    useState("");

  // Resource filters and pagination.
  const [searchQuery, setSearchQuery] =
    useState("");

  const [collegeFilter, setCollegeFilter] =
    useState(ALL_OPTION);

  const [departmentFilter, setDepartmentFilter] =
    useState(ALL_OPTION);

  const [levelFilter, setLevelFilter] =
    useState(ALL_OPTION);

  const [semesterFilter, setSemesterFilter] =
    useState(ALL_OPTION);

const [categoryFilter, setCategoryFilter] =
  useState(ALL_OPTION);

const [sortOrder, setSortOrder] = useState<
  "newest" | "oldest"
>("oldest");

const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");

const [page, setPage] = useState(1);

  const matchingCountRef = useRef<HTMLDivElement>(null);
  const previousPageRef = useRef(page);
  const pendingScrollRef = useRef(false);

  // Fetch only the requested page of filtered pending resources.
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
  "pending-resources",
  searchQuery.trim(),
  categoryFilter,
  collegeFilter,
  departmentFilter,
  levelFilter,
  semesterFilter,
  sortOrder,
  dateFrom,
  dateTo,
  page,
  PAGE_SIZE,
],

    queryFn: async () => {
      const {
        data: response,
        error,
      } = await supabase.rpc(
        "get_academic_pending_resources",
        {
  p_search: searchQuery.trim(),
  p_category_id: categoryFilter,
  p_college: collegeFilter,
  p_department: departmentFilter,
  p_level: levelFilter,
  p_semester: semesterFilter,
  p_page_size: PAGE_SIZE,
  p_page: page,
  p_sort: sortOrder,
  p_date_from: dateFrom || null,
  p_date_to: dateTo || null,
}
      );

      if (error) {
        throw error;
      }

      return response as unknown as PendingResourcesResponse;
    },
  });

  const {
    data: pendingUsers,
    isLoading: pendingUsersLoading,
  } = useQuery({
    queryKey: ["pending-users"],
    enabled: Boolean(canApproveUsers),

    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("private_profiles")
        .select(
          `
            id,
            full_name,
            email,
            primary_role,
            college,
            department,
            level,
            created_at,
            status
          `,
        )
        .eq("status", "pending")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as PendingUser[];
    },
  });

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const {
        data: categories,
        error,
      } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("deleted_at", null)
        .order("sort_order");

      if (error) {
        throw error;
      }

      return categories ?? [];
    },
  });

  const filteredResources =
    data?.resources ?? [];

  const totalCount =
    data?.totalCount ?? 0;

  const pendingCount =
    data?.pendingCount ?? 0;

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const firstResult =
  totalCount === 0
    ? 0
    : (page - 1) * PAGE_SIZE + 1;

const lastResult = Math.min(
  page * PAGE_SIZE,
  totalCount,
);

 // Start from the first page whenever a filter changes.
useEffect(() => {
  setPage(1);
}, [
  searchQuery,
  categoryFilter,
  collegeFilter,
  departmentFilter,
  levelFilter,
  semesterFilter,
  sortOrder,
  dateFrom,
  dateTo,
]);

 /*
 * Remember that a page change requires scrolling to the matching-count row.
 */
useEffect(() => {
  if (previousPageRef.current === page) return;

  previousPageRef.current = page;
  pendingScrollRef.current = true;
}, [page]);

/*
 * Scroll after the requested page's data has finished loading.
 */
useEffect(() => {
  if (
    !pendingScrollRef.current ||
    isLoading ||
    isError ||
    !data
  ) {
    return;
  }

  const target = matchingCountRef.current;

  if (!target) return;

  pendingScrollRef.current = false;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [page, isLoading, isError, data]);

  // If a decision or changed result set reduces the number of pages,
  // move back to the last page that still exists.
  useEffect(() => {
  if (isLoading || isError || !data) return;

  if (page > totalPages) {
    setPage(totalPages);
  }
  }, [page, totalPages, isLoading, isError, data]);

  const departments =
    collegeFilter === ALL_OPTION
      ? []
      : getDepartments(collegeFilter);

  const hasActiveFilters =
  searchQuery.trim() !== "" ||
  collegeFilter !== ALL_OPTION ||
  departmentFilter !== ALL_OPTION ||
  levelFilter !== ALL_OPTION ||
  semesterFilter !== ALL_OPTION ||
  categoryFilter !== ALL_OPTION ||
  sortOrder !== "oldest" ||
  dateFrom !== "" ||
  dateTo !== "";

  const clearFilters = () => {
  setSearchQuery("");
  setCollegeFilter(ALL_OPTION);
  setDepartmentFilter(ALL_OPTION);
  setLevelFilter(ALL_OPTION);
  setSemesterFilter(ALL_OPTION);
  setCategoryFilter(ALL_OPTION);
  setSortOrder("newest");
  setDateFrom("");
  setDateTo("");
  setPage(1);
};

  const decide = useMutation({
    mutationFn: async (v: {
      id: string;
      file_path: string;
      title: string;
      approve: boolean;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      const normalizedReason =
        v.reason.trim();

      if (!normalizedReason) {
        throw new Error(
          v.approve
            ? "An approval reason is required."
            : "A rejection reason is required.",
        );
      }

      if (v.approve) {
        const {
          data,
          error,
        } = await supabase.rpc(
          "approve_resource",
          {
            _resource_id: v.id,
            _approval_reason: normalizedReason,
          },
        );

        if (error) {
          throw error;
        }

        if (data !== true) {
          throw new Error(
            "Resource approval was not completed.",
          );
        }

        return;
      }

      const {
        data: removedFiles,
        error: storageError,
      } = await supabase.storage
        .from("resources")
        .remove([v.file_path]);

      if (storageError) {
        throw new Error(
          `Could not remove the uploaded file: ${storageError.message}`,
        );
      }

      if (
        !removedFiles ||
        removedFiles.length === 0
      ) {
        throw new Error(
          "The uploaded file could not be removed from Storage.",
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "reject_resource",
        {
          _resource_id: v.id,
          _rejection_reason:
            normalizedReason,
        },
      );

      if (error) {
        throw new Error(
          `The file was removed, but the resource record could not be updated: ${error.message}`,
        );
      }

      if (data !== true) {
        throw new Error(
          "Resource rejection was not completed.",
        );
      }
    },

    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve
          ? "Resource approved successfully."
          : "Resource rejected. The file was removed and the record was retained for history.",
      );

      setPreviewResource(null);
      setPendingDecision(null);
      setDecisionReason("");

      qc.invalidateQueries({
        queryKey: ["pending-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-resource-moderation-audits",
        ],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      qc.invalidateQueries({
        queryKey: ["my-uploads"],
      });

      qc.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const decideUser = useMutation({
    mutationFn: async (v: {
      id: string;
      approve: boolean;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      const normalizedReason =
        v.reason.trim();

      if (!normalizedReason) {
        throw new Error(
          "A reason is required for this account status change.",
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "admin_set_user_status",
        {
          _target_user_id: v.id,
          _new_status: v.approve
            ? "active"
            : "rejected",
          _reason: normalizedReason,
        },
      );

      if (error) {
        throw error;
      }

      if (data !== true) {
        throw new Error(
          "The account status change was not completed.",
        );
      }
    },

    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve
          ? "User account approved successfully."
          : "User account rejected successfully.",
      );

      setPendingUserDecision(null);
      setUserDecisionReason("");

      qc.invalidateQueries({
        queryKey: ["pending-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-user-audits"],
      });

      qc.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const requestApprove = (
    id: string,
    file_path: string,
    title: string,
  ) => {
    setDecisionReason("");

    setPendingDecision({
      type: "approve",
      id,
      file_path,
      title,
    });
  };

  const requestReject = (
    id: string,
    file_path: string,
    title: string,
  ) => {
    setDecisionReason("");

    setPendingDecision({
      type: "reject",
      id,
      file_path,
      title,
    });
  };

  const requestApproveUser = (
    id: string,
    name: string,
    email: string,
  ) => {
    setUserDecisionReason("");

    setPendingUserDecision({
      type: "approve",
      id,
      name,
      email,
    });
  };

  const requestRejectUser = (
    id: string,
    name: string,
    email: string,
  ) => {
    setUserDecisionReason("");

    setPendingUserDecision({
      type: "reject",
      id,
      name,
      email,
    });
  };

  const confirmDecision = () => {
    if (!pendingDecision) {
      return;
    }

    const reason =
      decisionReason.trim();

    if (!reason) {
      toast.error(
        pendingDecision.type === "approve"
          ? "Please provide an approval reason before approving this resource."
          : "Please provide a rejection reason before rejecting this resource.",
      );
      return;
    }

    decide.mutate({
      id: pendingDecision.id,
      file_path: pendingDecision.file_path,
      title: pendingDecision.title,
      approve:
        pendingDecision.type === "approve",
      reason,
    });
  };

  const confirmUserDecision = () => {
    if (!pendingUserDecision) {
      return;
    }

    const reason =
      userDecisionReason.trim();

    if (!reason) {
      toast.error(
        "Please provide a reason before continuing.",
      );
      return;
    }

    decideUser.mutate({
      id: pendingUserDecision.id,
      approve:
        pendingUserDecision.type === "approve",
      reason,
    });
  };

  const decisionLoading =
    decide.isPending;

  const userDecisionLoading =
    decideUser.isPending;

  return (
    <>
      <section className="space-y-5 sm:space-y-6">
        {/* Approval section navigation — admins and co-admins only */}
{canApproveUsers && (
  <div className="border-b border-border">
    <div
      className="flex items-center gap-4 overflow-x-auto sm:gap-6"
      role="tablist"
      aria-label="Approval sections"
    >
      {/* Resource Approval */}
      <button
        type="button"
        role="tab"
        aria-selected={activeSection === "resources"}
        onClick={() => setActiveSection("resources")}
        className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 text-xs font-semibold transition-colors sm:gap-2 sm:pb-3 sm:text-sm ${
          activeSection === "resources"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Resources

        {pendingCount > 0 && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] leading-none font-semibold text-gold-foreground sm:h-5 sm:w-5 sm:text-[10px]">
            {pendingCount}
          </span>
        )}
      </button>

      {/* User Approval */}
      <button
        type="button"
        role="tab"
        aria-selected={activeSection === "users"}
        onClick={() => setActiveSection("users")}
        className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 text-xs font-semibold transition-colors sm:gap-2 sm:pb-3 sm:text-sm ${
          activeSection === "users"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Users

        {pendingUsers && pendingUsers.length > 0 && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] leading-none font-semibold text-gold-foreground sm:h-5 sm:w-5 sm:text-[10px]">
            {pendingUsers.length}
          </span>
        )}
      </button>
    </div>
  </div>
)}

        {/* User Approval */}
        {activeSection === "users" &&
          canApproveUsers && (
            <div>
              {pendingUsersLoading ? (
                <div className="p-7 text-center text-xs text-muted-foreground sm:p-8 sm:text-sm">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                    Loading pending accounts…
                  </div>
                </div>
              ) : pendingUsers &&
                pendingUsers.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
  {pendingUsers.map((pendingUser) => {
    const isProcessing =
      userDecisionLoading &&
      decideUser.variables?.id === pendingUser.id;

    const displayName =
      pendingUser.full_name?.trim() ||
      "Unnamed user";

    const email =
      pendingUser.email?.trim() ||
      "No email available";

    const RoleIcon = getRoleIcon(
      pendingUser.primary_role,
    );

    return (
      <li
        key={pendingUser.id}
        className="flex min-w-0 flex-col rounded-sm border border-border bg-card p-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant sm:p-4"
      >
        {/* Passport-style identity header */}
<div className="flex flex-col items-center">
  <div className="flex w-full items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-1 text-[9px] font-medium text-gold sm:text-[10px]">
      <RoleIcon className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {formatRoleLabel(pendingUser.primary_role)}
      </span>
    </div>

    <span className="shrink-0 text-right text-[9px] font-medium text-muted-foreground sm:text-[10px]">
      {formatDateTime(pendingUser.created_at)}
    </span>
  </div>

  <div className="mt-3 flex h-25 w-25 items-center justify-center">
  <img
    src={photo}
    alt="User profile"
    className="h-20 w-20 rounded-full object-cover"
  />
</div>
</div>

{/* User identity details */}
<div className="mt-3 min-w-0 border-t border-border pt-3 text-center">
  <p className="break-words text-xs font-semibold leading-5 text-foreground sm:text-sm">
    {displayName}
  </p>

  <p className="mt-1 break-all text-[10px] leading-4 text-muted-foreground sm:text-xs">
    {email}
  </p>
</div>

{/* Academic details */}
<div className="mt-3 flex-1 space-y-3 border-t border-border pt-3 text-center">
  {pendingUser.college?.trim() && (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">College</p>
      <p className="text-sm font-medium">
        {pendingUser.college.trim()}
      </p>
    </div>
  )}

  {pendingUser.department?.trim() && (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">Department</p>
      <p className="text-sm font-medium">
        {pendingUser.department.trim()}
      </p>
    </div>
  )}

  {pendingUser.primary_role === "student" &&
    pendingUser.level?.trim() && (
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">Level</p>
        <p className="text-sm font-medium">
          {pendingUser.level.trim()}
        </p>
      </div>
    )}
</div>

        {/* Account actions */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 border-t border-border pt-3 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={userDecisionLoading}
            onClick={() =>
              requestRejectUser(
                pendingUser.id,
                displayName,
                email,
              )
            }
            className="h-8 min-w-0 bg-muted px-1.5 text-[10px] text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-9 sm:px-2 sm:text-xs"
          >
            {isProcessing &&
            pendingUserDecision?.type === "reject" ? (
              <Loader2 className="mr-1 h-3 w-3 shrink-0 animate-spin" />
            ) : (
              <X className="mr-1 h-3 w-3 shrink-0" />
            )}

            Reject
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={userDecisionLoading}
            onClick={() =>
              requestApproveUser(
                pendingUser.id,
                displayName,
                email,
              )
            }
            className="h-8 min-w-0 bg-muted px-1.5 text-[10px] text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-2 sm:text-xs"
          >
            {isProcessing &&
            pendingUserDecision?.type === "approve" ? (
              <Loader2 className="mr-1 h-3 w-3 shrink-0 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3 shrink-0" />
            )}

            Approve
          </Button>
        </div>
      </li>
    );
  })}
</ul>
              ) : (
                <EmptyState
                  title="No pending accounts"
                  desc="All newly registered accounts have been reviewed."
                />
              )}
            </div>
          )}

        {/* Resource Approval */}
        {activeSection === "resources" && (
          <div className="space-y-4">
            {/* Resource filters — always visible */}
            <div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                <p className="text-xs font-semibold sm:text-sm">
                  Find resources
                </p>
              </div>

      <div className="space-y-2.5 sm:space-y-3">
  {/* Search */}
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

    <Input
      placeholder="Search title, course code, description…"
      value={searchQuery}
      onChange={(event) =>
        setSearchQuery(event.target.value)
      }
      aria-label="Search pending resources"
      className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
    />
  </div>

  {/* Category */}
    <div className="min-w-0">
      <Select
        value={categoryFilter}
        onValueChange={setCategoryFilter}
      >
        <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
          <SelectValue placeholder="Category" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_OPTION}>
            All Categories
          </SelectItem>

          {cats?.map((category) => (
            <SelectItem
              key={category.id}
              value={category.id}
            >
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* College and department */}
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
      {/* College */}
      <div className="min-w-0">
        <Select
          value={collegeFilter}
          onValueChange={(value) => {
            setCollegeFilter(value);
            setDepartmentFilter(ALL_OPTION);
          }}
        >
          <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
            <SelectValue placeholder="College" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL_OPTION}>
              All Colleges
            </SelectItem>

            {colleges.map((college) => (
              <SelectItem
                key={college.id}
                value={college.id}
              >
                <>
                  <span className="sm:hidden">
                    {college.id}
                  </span>

                  <span className="hidden sm:inline">
                    {college.name} ({college.id})
                  </span>
                </>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department */}
      <div className="min-w-0">
        <Select
          value={departmentFilter}
          onValueChange={setDepartmentFilter}
          disabled={collegeFilter === ALL_OPTION}
        >
          <SelectTrigger
            className={`h-9 text-xs sm:h-10 sm:text-sm ${
              collegeFilter === ALL_OPTION
                ? "opacity-60"
                : ""
            }`}
          >
            <SelectValue placeholder="Department" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL_OPTION}>
              All Departments
            </SelectItem>

            {departments.map((department) => (
              <SelectItem
                key={department}
                value={department}
              >
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    {/* Level and semester */}
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
      {/* Level */}
      <div className="min-w-0">
        <Select
          value={levelFilter}
          onValueChange={setLevelFilter}
        >
          <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
            <SelectValue placeholder="Level" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL_OPTION}>
              All Levels
            </SelectItem>

            {levels.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Semester */}
      <div className="min-w-0">
        <Select
          value={semesterFilter}
          onValueChange={setSemesterFilter}
        >
          <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
            <SelectValue placeholder="Semester" />
          </SelectTrigger>

          <SelectContent>
  <SelectItem value={ALL_OPTION}>
    Both Semesters
  </SelectItem>

  {semesters.map((item) => (
    <SelectItem key={item} value={item}>
      {item}
    </SelectItem>
  ))}
</SelectContent>
        </Select>
      </div>
    </div>

    
{/* Sort and date range */}
<div className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-3 sm:gap-3">

  {/* Sort */}
  <div className="col-span-2 min-w-0 sm:col-span-1">
    <Select
      value={sortOrder}
      onValueChange={(value) =>
        setSortOrder(value as "newest" | "oldest")
      }
    >
      <SelectTrigger
        id="academic-sort"
        className="h-9 w-full min-w-0 px-3 text-xs sm:h-10 sm:text-sm"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
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
          aria-label="Filter academic resources from this date"
          className="h-9 w-full min-w-0 justify-between bg-card px-2 text-xs font-normal sm:h-10 sm:text-sm"
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
          aria-label="Filter academic resources up to this date"
          className="h-9 w-full min-w-0 justify-between bg-card px-2 text-xs font-normal sm:h-10 sm:text-sm"
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
  </div>

              {/* Matching count and clear filters */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <p
                  className="min-w-0 pl-2 text-xs text-gold sm:text-sm"
                  aria-live="polite"
                >
                  {isLoading ? (
                    "Loading resource count…"
                  ) : isError ? (
                    "Resource count unavailable"
                  ) : totalCount === 0 ? (
                    <>
                      Showing{" "}
                      <span className="font-semibold text-gold">
                        0
                      </span>{" "}
                      resources
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
                      matching pending{" "}
                      {totalCount === 1
                        ? "resource"
                        : "resources"}
                    </>
                  )}
                </p>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 pr-3 text-xs text-gold sm:h-8"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span>Clear filters</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Resource results — separate from filters */}
            <div className="overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                    Loading review queue…
                  </div>
                </div>
              ) : isError ? (
                <div className="p-7 text-center sm:p-10">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Could not load pending resources. Please try again.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void refetch()}
                    className="mt-3 h-9 text-xs sm:text-sm"
                  >
                    Try again
                  </Button>
                </div>
              ) : filteredResources.length > 0 ? (
                <>
                  <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
  {filteredResources.map((resource) => {
    const isProcessing =
      decisionLoading &&
      decide.variables?.id === resource.id;

    const canPreview =
      resource.file_size > 0 &&
      resource.status === "pending";

    const categoryName =
      resource.category?.deleted_at == null &&
      resource.category?.name?.trim()
        ? resource.category.name.trim()
        : "Uncategorized";

    const collegeLabel = resource.college
      ? getResourceScopeLabel(resource.college, "college")
      : "";

    const collegeShort =
      collegeLabel.match(/\((.*?)\)/)?.[1] ??
      collegeLabel;

    const departmentLabel = resource.department
      ? getResourceScopeLabel(resource.department, "department")
      : "";

    const levelLabel = resource.level
      ? getResourceScopeLabel(resource.level, "level")
      : "";

    const semesterLabel = resource.semester
      ? getResourceScopeLabel(resource.semester, "semester")
      : "";

    return (
      <li
        key={resource.id}
        className="group flex min-w-0 flex-col rounded-sm border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant sm:p-5"
      >
        {/* Category and file type */}
        <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase text-gold sm:text-xs">
            {categoryName}
          </span>

          <div className="shrink-0">
            <ResourceTypeBadge
              filePath={resource.file_name || ""}
            />
          </div>
        </div>

        {/* Resource title */}
        <h3 className="line-clamp-2 break-words font-display text-[13px] font-semibold leading-snug sm:text-lg">
          {resource.title}
        </h3>

        {/* Filename */}
        <p className="mt-1 break-all text-xs text-muted-foreground sm:text-xs">
  {resource.file_name || "Unnamed file"}
  <span className="mx-1">·</span>
  <span>{formatFileSize(resource.file_size)}</span>
</p>
        {/* Description */}
        {resource.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:mt-2 sm:text-xs">
            {resource.description}
          </p>
        )}

        {/* Academic details */}
        <div className="mt-2.5 space-y-1.5 text-xs sm:mt-3 sm:space-y-2 sm:text-sm">
          {resource.course_code?.trim() && (
            <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground sm:gap-3">
              <BookOpen className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="min-w-0 break-words">
                {resource.course_code.trim()}
              </span>
            </div>
          )}

          {resource.college?.trim() && (
            <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground sm:gap-3">
              <School className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="min-w-0 break-words">
                {collegeShort}
              </span>
            </div>
          )}

          {resource.department?.trim() && (
            <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground sm:gap-3">
              <Building2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="min-w-0 break-words">
                {departmentLabel}
              </span>
            </div>
          )}

          {resource.level?.trim() && (
            <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground sm:gap-3">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="min-w-0 break-words">
                {levelLabel}
              </span>
            </div>
          )}

          {resource.semester?.trim() && (
            <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground sm:gap-3">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="min-w-0 break-words">
                {semesterLabel}
              </span>
            </div>
          )}
        </div>

        {/* Uploader and submission information */}
        <div className="mt-auto space-y-3  border-border pt-3 sm:pt-4">
          <div>
            <p className="text-[10px] font-semibold text-foreground sm:text-xs">
              Uploader
            </p>

            <p className="mt-0.5 break-words text-[10px] text-muted-foreground sm:text-xs">
              {resource.uploader?.full_name?.trim() ||
                resource.uploader?.email?.trim() ||
                "Unknown"}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              {formatDateTime(resource.created_at)}
            </p>
          </div>
        </div>

        {/* Resource actions */}
        <div className="mt-3 flex flex-row gap-1.5 border-t border-border pt-3 sm:mt-4 sm:gap-2">
          {canPreview && (
            <Button
              type="button"
              variant="outline"
              disabled={decisionLoading}
              onClick={() =>
                setPreviewResource({
                  id: resource.id,
                  title: resource.title,
                  file_path: resource.file_path,
                })
              }
              className="h-8 min-w-0 flex-1 gap-0 bg-muted px-1 text-xs sm:h-9 sm:text-sm"
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Preview
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={decisionLoading}
            onClick={() =>
              requestReject(
                resource.id,
                resource.file_path,
                resource.title,
              )
            }
            className="h-8 min-w-0 flex-1 gap-0 bg-muted px-1 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-9 sm:text-sm"
          >
            {isProcessing &&
            !decide.variables?.approve ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="mr-1 h-3.5 w-3.5" />
            )}
            Reject
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={decisionLoading}
            onClick={() =>
              requestApprove(
                resource.id,
                resource.file_path,
                resource.title,
              )
            }
            className="h-8 min-w-0 flex-1 gap-0 bg-muted px-1 text-xs text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:text-sm"
          >
            {isProcessing &&
            decide.variables?.approve ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Approve
          </Button>
        </div>
      </li>
    );
  })}
</ul>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="grid grid-cols-3 items-center gap-2 border-t border-border p-3 sm:p-4">
                      <div className="flex justify-start">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() =>
                            setPage((current) =>
                              Math.max(1, current - 1),
                            )
                          }
                          className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
                        >
                          <ChevronLeft className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Previous
                        </Button>
                      </div>

                      <span className="text-center text-[10px] text-muted-foreground sm:text-xs">
                        Page{" "}
                        <span className="font-medium text-foreground">
                          {page}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-foreground">
                          {totalPages}
                        </span>
                      </span>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={page >= totalPages}
                          onClick={() =>
                            setPage((current) =>
                              Math.min(
                                totalPages,
                                current + 1,
                              ),
                            )
                          }
                          className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
                        >
                          Next
                          <ChevronRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : hasActiveFilters ? (
                <EmptyState
                  title="No matching resources"
                  desc="No pending resources match the selected filters."
                />
              ) : (
                <EmptyState
                  title="No pending resources"
                  desc="No resources are waiting for review right now."
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Resource decision dialog */}
      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open && !decisionLoading) {
            setPendingDecision(null);
            setDecisionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingDecision?.type === "approve"
                ? "Approve resource?"
                : "Reject resource?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingDecision?.type === "approve" ? (
                <>
                  Are you sure you want to approve{" "}
                  <strong>{pendingDecision.title}</strong>?
                  The resource will become available in the
                  Library and the uploader will receive a
                  notification.
                </>
              ) : (
                <>
                  Are you sure you want to reject{" "}
                  <strong>{pendingDecision?.title}</strong>?
                  The uploaded file will be permanently
                  removed, while the resource record will be
                  retained for history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision && (
            <div className="space-y-2.5 sm:space-y-2">
              <label
                htmlFor="resource-decision-reason"
                className="text-xs font-medium sm:text-sm"
              >
                {pendingDecision.type === "approve"
                  ? "Approval reason"
                  : "Rejection reason"}
              </label>

              <Input
                id="resource-decision-reason"
                value={decisionReason}
                onChange={(event) =>
                  setDecisionReason(event.target.value)
                }
                placeholder={
                  pendingDecision.type === "approve"
                    ? "e.g. Content verified and meets Library submission requirements"
                    : "e.g. Incorrect course material or poor-quality scan"
                }
                disabled={decisionLoading}
                required
                aria-required="true"
                className="h-9 text-xs sm:h-10 sm:text-sm"
              />

              <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                A{" "}
                {pendingDecision.type === "approve"
                  ? "reason for approval"
                  : "reason for rejection"}{" "}
                is required before continuing.
              </p>
            </div>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={decisionLoading}
              className="h-9 bg-muted text-xs text-muted-foreground shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-white sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDecision();
              }}
              disabled={
                decisionLoading ||
                !decisionReason.trim()
              }
              className={`h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm ${
                pendingDecision?.type === "reject"
                  ? "bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground"
                  : "bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground"
              }`}
            >
              {decisionLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {decisionLoading
                ? pendingDecision?.type === "approve"
                  ? "Approving…"
                  : "Rejecting…"
                : pendingDecision?.type === "approve"
                  ? "Approve resource"
                  : "Reject resource"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User account decision dialog */}
      <AlertDialog
        open={pendingUserDecision !== null}
        onOpenChange={(open) => {
          if (!open && !userDecisionLoading) {
            setPendingUserDecision(null);
            setUserDecisionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingUserDecision?.type === "approve"
                ? "Approve user account?"
                : "Reject user account?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingUserDecision?.type === "approve" ? (
                <>
                  Are you sure you want to approve{" "}
                  <strong>{pendingUserDecision.name}</strong>?
                  This will activate the account and allow the
                  user to access Aneks Library.
                </>
              ) : (
                <>
                  Are you sure you want to reject{" "}
                  <strong>{pendingUserDecision?.name}</strong>?
                  The account will remain rejected and will not
                  be granted access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5 sm:space-y-2">
            <label
              htmlFor="user-decision-reason"
              className="text-xs font-medium sm:text-sm"
            >
              {pendingUserDecision?.type === "approve"
                ? "Approval reason"
                : "Rejection reason"}
            </label>

            <Input
              id="user-decision-reason"
              value={userDecisionReason}
              onChange={(event) =>
                setUserDecisionReason(event.target.value)
              }
              placeholder={
                pendingUserDecision?.type === "approve"
                  ? "e.g. Registration details verified"
                  : "e.g. Registration details could not be verified"
              }
              disabled={userDecisionLoading}
              required
              aria-required="true"
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
              A reason is required and will be recorded in
              the account audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={userDecisionLoading}
              className="h-9 bg-muted text-xs text-muted-foreground shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-white sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmUserDecision();
              }}
              disabled={
                userDecisionLoading ||
                !userDecisionReason.trim()
              }
              className={`h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm ${
                pendingUserDecision?.type === "reject"
                  ? "bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground"
                  : "bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground"
              }`}
            >
              {userDecisionLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {userDecisionLoading
                ? pendingUserDecision?.type === "approve"
                  ? "Approving…"
                  : "Rejecting…"
                : pendingUserDecision?.type === "approve"
                  ? "Approve account"
                  : "Reject account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewResource && (
        <PreviewModal
          resource={previewResource}
          onClose={() =>
            setPreviewResource(null)
          }
        />
      )}
    </>
  );
}

function getPendingUserDetails(
  user: PendingUser,
): {
  label: string;
  value: string;
}[] {
  const details: {
    label: string;
    value: string;
  }[] = [];

  const role = user.primary_role;

  const showAcademicDetails = [
    "student",
    "lecturer",
    "staff",
  ].includes(role);

  if (
    showAcademicDetails &&
    user.college?.trim()
  ) {
    details.push({
      label: "College",
      value: user.college.trim(),
    });
  }

  if (
    showAcademicDetails &&
    user.department?.trim()
  ) {
    details.push({
      label: "Department",
      value: user.department.trim(),
    });
  }

  if (
    role === "student" &&
    user.level?.trim()
  ) {
    details.push({
      label: "Level",
      value: user.level.trim(),
    });
  }

  return details;
}

function StatusPill({
  status,
}: {
  status: ResourceStatus;
}) {
  const config: Record<
    ResourceStatus,
    {
      label: string;
      className: string;
      icon: typeof CheckCircle2;
    }
  > = {
    approved: {
      label: "Approved",
      className:
        "border-primary/20 bg-primary/10 text-primary",
      icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      className:
        "border-gold/20 bg-gold/10 text-gold",
      icon: Clock3,
    },
    rejected: {
      label: "Rejected",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    deleted: {
      label: "Deleted",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    draft: {
      label: "Draft",
      className:
        "border-border bg-muted/30 text-muted-foreground",
      icon: FileText,
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:gap-1 sm:px-2 sm:text-[10px] ${item.className}`}
    >
      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      {item.label}
    </span>
  );
}

function AuditItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-l-2 border-border pl-2.5 sm:pl-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px]">
        {label}
      </p>

      <p className="mt-0.5 text-[10px] font-medium text-foreground sm:mt-1 sm:text-xs">
        {value}
      </p>

      {detail && (
        <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {detail}
        </p>
      )}
    </div>
  );
}

const roleIcons: Record<string, typeof UserRound> = {
  admin: ShieldCheck,
  "co-admin": Shield,
  coadmin: Shield,
  lecturer: Presentation,
  staff: ClipboardList,
  student: NotebookPen,
  researcher: Microscope,
  guest: UserRoundSearch,
};

function getRoleIcon(role: string | null | undefined) {
  return roleIcons[role ?? "guest"] ?? UserRound;
}

function formatRoleLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .toUpperCase();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024),
  );

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function PreviewModal({
  resource,
  onClose,
}: {
  resource: {
    id: string;
    title: string;
    file_path: string;
  };
  onClose: () => void;
}) {
  const [scrollRoot, setScrollRoot] =
    useState<HTMLDivElement | null>(null);

  const {
    data: previewUrl,
    isLoading,
  } = useQuery({
    queryKey: [
      "admin-preview-url",
      resource.id,
    ],

queryFn: async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(
      "Your session has expired. Please sign in again.",
    );
  }

  return {
    url:
      `${import.meta.env.VITE_SUPABASE_URL}` +
      `/functions/v1/preview-resource`,
    accessToken: session.access_token,
  };
},
});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl sm:max-h-[95vh] sm:rounded-sm">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium sm:text-sm">
              {resource.title}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              Resource preview
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
            className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <div
          ref={(node) =>
            setScrollRoot(node)
          }
          className="min-h-0 flex-1 overflow-auto p-2.5 sm:p-4"
        >
          {isLoading || !previewUrl ? (
            <div className="flex min-h-[60vh] items-center justify-center text-xs text-muted-foreground sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                Preparing preview…
              </div>
            </div>
          ) : (
            <DocumentPreview
              url={previewUrl.url}
              token={previewUrl.accessToken}
              resourceId={resource.id}
              context="approvals"
              filePath={resource.file_path}
              title={resource.title}
              scrollRoot={scrollRoot}
            />
          )}
        </div>
      </div>
    </div>
  );
}