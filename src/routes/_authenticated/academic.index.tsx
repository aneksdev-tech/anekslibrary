import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Clock3, ChevronLeft, ChevronRight, Eye, FileText, Loader2, Search, X, XCircle, } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./dashboard";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { colleges, levels, semesters, getDepartments, ALL_OPTION } from "@/lib/academicData";
import { getResourceScopeLabel } from "@/lib/resource-scope-labels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 10;

export const Route = createFileRoute(
  "/_authenticated/academic/",
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

    if (profile.primary_role !== "lecturer") {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }
  },

  head: () => ({
    meta: [
      {
        title: "Resource Approvals | Academic | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: AcademicApprovals,
});

type ResourceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

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

type PendingQueueResponse = {
  totalCount: number;
  pendingCount: number;
  resources: Resource[];
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

function AcademicApprovals() {
  const { user, profile, roles, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [previewResource, setPreviewResource] = useState<{
    id: string;
    title: string;
    file_path: string;
  } | null>(null);

  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);

  const [decisionReason, setDecisionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState(ALL_OPTION);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_OPTION);
  const [levelFilter, setLevelFilter] = useState(ALL_OPTION);
  const [semesterFilter, setSemesterFilter] = useState(ALL_OPTION);
  const [categoryFilter, setCategoryFilter] = useState(ALL_OPTION);

  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(
    "oldest",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);

  const pendingResourcesHeaderRef = useRef<HTMLDivElement>(null);
  const previousPageRef = useRef(page);
  const pendingScrollRef = useRef(false);


const departments =
  collegeFilter === ALL_OPTION
    ? []
    : getDepartments(collegeFilter);

  /*
   * Reset pagination whenever a filter, sort order,
   * or search term changes.
   */
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    collegeFilter,
    departmentFilter,
    levelFilter,
    semesterFilter,
    categoryFilter,
    sortOrder,
    dateFrom,
    dateTo,
  ]);

/*
 * Keep the page reactive if the lecturer's role or status
 * changes while the page is open.
 */
useEffect(() => {
  if (loading || !profile || !user) {
    return;
  }

  if (
    profile.status !== "active" ||
    !roles?.includes("lecturer")
  ) {
    toast.error(
      "Your account no longer has permission to access the Academic Workspace.",
    );

    navigate({
      to: "/dashboard",
      replace: true,
    });
  }
}, [loading, profile, user, roles, navigate]);

  /*
   * The RPC performs filtering, sorting, counting and pagination
   * in Supabase. Only the current page is returned to the browser.
   */
  const {
    data: queueData,
    isLoading,
    isError,
    error: queueError,
  } = useQuery({
    queryKey: [
      "academic-pending-resources",
      searchQuery.trim(),
      collegeFilter,
      departmentFilter,
      levelFilter,
      semesterFilter,
      categoryFilter,
      sortOrder,
      dateFrom,
      dateTo,
      page,
      PAGE_SIZE,
    ],

    queryFn: async (): Promise<PendingQueueResponse> => {
      const { data, error } = await supabase.rpc(
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
        },
      );

      if (error) {
        throw error;
      }

      return data as unknown as PendingQueueResponse;
    },
  });

const resources = queueData?.resources ?? [];
const totalCount = queueData?.totalCount ?? 0;
const pendingCount = queueData?.pendingCount ?? 0;
const totalPages = Math.max(
  1,
  Math.ceil(totalCount / PAGE_SIZE),
);

const firstResult =
  totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

const lastResult = Math.min(
  page * PAGE_SIZE,
  totalCount,
);

/*
 * Remember that a page change requires scrolling to the queue heading.
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
    !queueData
  ) {
    return;
  }

  const header = pendingResourcesHeaderRef.current;

  if (!header) return;

  pendingScrollRef.current = false;

  header.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [page, isLoading, isError, queueData]);

/*
 * If an action removes the last resource from the current page,
 * return to the last valid page after the count updates.
 * Wait for the current query to finish before validating the page.
 */
useEffect(() => {
  if (isLoading || isError || !queueData) return;

  if (page > totalPages) {
    setPage(totalPages);
  }
}, [page, totalPages, isLoading, isError, queueData]);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data: categories, error } = await supabase
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

      const normalizedReason = v.reason.trim();

      if (!normalizedReason) {
        throw new Error(
          v.approve
            ? "An approval reason is required."
            : "A rejection reason is required.",
        );
      }

      if (v.approve) {
        const { data, error } = await supabase.rpc(
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

      const { data: removedFiles, error: storageError } =
        await supabase.storage
          .from("resources")
          .remove([v.file_path]);

      if (storageError) {
        throw new Error(
          `Could not remove the uploaded file: ${storageError.message}`,
        );
      }

      if (!removedFiles || removedFiles.length === 0) {
        throw new Error(
          "The uploaded file could not be removed from Storage.",
        );
      }

      const { data, error } = await supabase.rpc(
        "reject_resource",
        {
          _resource_id: v.id,
          _rejection_reason: normalizedReason,
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
          : "Resource rejected. The file was removed and the record was retained.",
      );

      setPreviewResource(null);
      setPendingDecision(null);
      setDecisionReason("");

      qc.invalidateQueries({
        queryKey: ["academic-pending-resources"],
      });
      qc.invalidateQueries({
        queryKey: ["pending-resources"],
      });
      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });
      qc.invalidateQueries({
        queryKey: ["admin-resource-moderation-audits"],
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

  const confirmDecision = () => {
    if (!pendingDecision) {
      return;
    }

    const reason = decisionReason.trim();

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
      approve: pendingDecision.type === "approve",
      reason,
    });
  };

  const decisionLoading = decide.isPending;

  return (
    <>
      <section className="space-y-5 sm:space-y-6">
        {/* Header */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold sm:text-xs sm:tracking-[0.22em]">
            Academic
          </p>

          <h1 className="mt-1 font-display text-lg font-semibold tracking-tight sm:mt-2 sm:text-3xl">
            Resource Approvals
          </h1>

          <p className="mt-1.5 max-w-3xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-base sm:leading-normal">
            Review academic resources submitted to Aneks Library and
            approve or reject them based on their content and quality.
          </p>
        </section>

        {/* Pending resources: total queue, not filtered count */}
        <div
          ref={pendingResourcesHeaderRef}
          className="scroll-mt-20 flex items-center gap-2.5 border-b border-border pb-3 sm:gap-3 sm:pb-4"
          >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-muted sm:h-9 sm:w-9">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-xs font-semibold sm:text-sm">
                Pending Resources
              </p>

              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-semibold leading-none text-gold-foreground sm:h-5 sm:w-5"
                aria-label={`${pendingCount} pending resources`}
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground sm:text-xs">
              Resources awaiting academic review
            </p>
          </div>
        </div>

{/* Filters */}
<div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
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
        <SelectItem value="newest">
          Newest
        </SelectItem>

        <SelectItem value="oldest">
          Oldest
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Date from */}
  <div className="min-w-0">
    <input
      id="academic-date-from"
      type="date"
      value={dateFrom}
      max={dateTo || undefined}
      onChange={(event) =>
        setDateFrom(event.target.value)
      }
      aria-label="Filter academic resources from this date"
      className="block h-9 w-full min-w-0 rounded-sm border border-input bg-card px-1 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10 sm:px-2 sm:text-sm"
    />
  </div>

  {/* Date to */}
  <div className="min-w-0">
    <input
      id="academic-date-to"
      type="date"
      value={dateTo}
      min={dateFrom || undefined}
      onChange={(event) =>
        setDateTo(event.target.value)
      }
      aria-label="Filter academic resources up to this date"
      className="block h-9 w-full min-w-0 rounded-sm border border-input bg-card px-1 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10 sm:px-2 sm:text-sm"
    />
  </div>
</div>
</div>

  {/* Result count and clear filters */}
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
    <p className="pl-2 text-xs text-gold sm:text-sm">
      {isLoading ? (
        "Loading resource count…"
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
          {totalCount === 1 ? "resource" : "resources"}
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
{/* Resource queue */}
        <div>
        <div className="overflow-hidden rounded-sm border border-border bg-card shadow-soft sm:rounded-sm">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                Loading review queue…
              </div>
            </div>
          ) : isError ? (
            <div className="p-6 text-center sm:p-8">
              <p className="text-sm font-medium text-destructive">
                Could not load the review queue.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {queueError instanceof Error
                  ? queueError.message
                  : "An unexpected error occurred."}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void qc.invalidateQueries({
                    queryKey: ["academic-pending-resources"],
                  });
                }}
              >
                Try again
              </Button>
            </div>
          ) : resources.length > 0 ? (
            <ul>
              {resources.map((resource) => {
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

                return (
                  <li
                    key={resource.id}
                    className="group border-b-2 border-border/70 p-3.5 transition-colors odd:bg-card even:bg-muted/40 hover:bg-muted/50 sm:p-5"
                  >
                    <div className="flex flex-col gap-3.5 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <StatusPill status={resource.status} />

                          <span className="max-w-[180px] truncate rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px] sm:px-2 sm:text-[10px]">
                            {categoryName}
                          </span>
                        </div>

                        <div className="mt-1.5 min-w-0 sm:mt-2">
                          <p className="break-words text-sm font-semibold leading-5 text-foreground sm:text-lg sm:leading-6">
                            {resource.title}
                          </p>

                          <p className="mt-1 break-all text-[10px] text-muted-foreground sm:text-xs">
                            {resource.file_name || "Unnamed file"}
                          </p>

                          {resource.description && (
                            <p className="mt-2 line-clamp-2 max-w-4xl text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Academic metadata */}
                      <div className="mt-3 grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
                        <AuditItem
                          label="File size"
                          value={formatFileSize(resource.file_size)}
                        />
                        {resource.course_code?.trim() && (
    <AuditItem
      label="Course code"
      value={resource.course_code.trim()}
    />
  )}

  {resource.college?.trim() && (
    <AuditItem
      label="College"
      value={getResourceScopeLabel(resource.college, "college")}
    />
  )}

  {resource.department?.trim() && (
    <AuditItem
      label="Department"
      value={getResourceScopeLabel(resource.department, "department")}
    />
  )}

  {resource.level?.trim() && (
    <AuditItem
      label="Level"
      value={getResourceScopeLabel(resource.level, "level")}
    />
  )}

  {resource.semester?.trim() && (
    <AuditItem
      label="Semester"
      value={getResourceScopeLabel(resource.semester, "semester")}
    />
  )}

  {resource.year && (
    <AuditItem
      label="Year"
      value={String(resource.year)}
    />
  )}
                      </div>

                      {/* Resource metadata */}
                      <div className="grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
                        <AuditItem
                          label="Uploader"
                          value={
                            resource.uploader?.full_name ||
                            resource.uploader?.email ||
                            "Unknown"
                          }
                          detail={formatDateTime(resource.created_at)}
                        />
                        <AuditItem
                          label="Submitted"
                          value="Pending review"
                          detail={formatDateTime(resource.created_at)}
                        />
                      </div>

                      {/* Resource actions */}
                      <div className="grid w-full grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3 sm:gap-3 sm:pt-4">
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
                            className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
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
                          className="h-9 w-full min-w-0 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-10 sm:text-sm bg-muted"
                        >
                          {isProcessing &&
                          !decide.variables?.approve ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                          ) : (
                            <X className="mr-1.5 h-3.5 w-3.5 shrink-0" />
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
                          className="h-9 w-full min-w-0 text-xs text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-10 sm:text-sm bg-muted"
                        >
                          {isProcessing &&
                          decide.variables?.approve ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : hasActiveFilters ? (
            <EmptyState
              title="No matching resources"
              desc="No pending resources match the selected filters."
            />
          ) : (
            <EmptyState
              title="No pending resources"
              desc="No resources are waiting for academic review right now."
            />
          )}
          </div>
        </div>

{/* Pagination */}
{!isLoading &&
  !isError &&
  totalCount > 0 && (
    <div className="border-t border-border pt-4">
      {totalPages > 1 && (
        <div className="grid grid-cols-3 items-center gap-2">
          {/* Previous: far left */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
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
              disabled={page >= totalPages || isLoading}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1),
                )
              }
              className="h-9 text-xs sm:text-sm"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingDecision?.type === "approve"
                ? "Approve resource?"
                : "Reject resource?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingDecision ? (
                pendingDecision.type === "approve" ? (
                  <>
                    Are you sure you want to approve{" "}
                    <strong>{pendingDecision.title}</strong>? The resource
                    will become available in the Library and the uploader
                    will receive a notification.
                  </>
                ) : (
                  <>
                    Are you sure you want to reject{" "}
                    <strong>{pendingDecision.title}</strong>? The uploaded
                    file will be permanently removed, while the resource
                    record will be retained for history.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision && (
            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="academic-resource-decision-reason"
                className="text-xs font-medium sm:text-sm"
              >
                {pendingDecision.type === "approve"
                  ? "Approval reason"
                  : "Rejection reason"}
              </label>

              <Input
                id="academic-resource-decision-reason"
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

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={decisionLoading}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDecision();
              }}
              disabled={
                decisionLoading || !decisionReason.trim()
              }
              className={`h-9 text-xs sm:h-10 sm:text-sm ${
                pendingDecision?.type === "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-gradient-emerald text-primary-foreground"
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

      {previewResource && (
        <PreviewModal
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </>
  );
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
      className: "border-primary/20 bg-primary/10 text-primary",
      icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      className: "border-gold/20 bg-gold/10 text-gold",
      icon: Clock3,
    },
    rejected: {
      label: "Rejected",
      className: "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    deleted: {
      label: "Deleted",
      className: "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    draft: {
      label: "Draft",
      className: "border-border bg-muted/30 text-muted-foreground",
      icon: FileText,
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2 sm:text-[10px] ${item.className}`}
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
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

  const { data: previewUrl, isLoading } = useQuery({
    queryKey: ["academic-preview-url", resource.id],

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
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl sm:max-h-[95vh] sm:rounded-sm">
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-border px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium sm:text-base">
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
          ref={setScrollRoot}
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
              context="academic"
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