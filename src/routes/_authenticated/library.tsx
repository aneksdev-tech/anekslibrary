import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAccess } from "@/hooks/useAccess";
import { supabase } from "@/integrations/supabase/client";
import { colleges, levels, semesters, getDepartments, ALL_OPTION } from "@/lib/academicData";
import { useAuth } from "@/lib/auth";
import { Bookmark, ChevronLeft, BookOpen, Building2, GraduationCap, School, CalendarDays, ChevronRight, Download, Search, Filter, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "./dashboard";
import { ResourceTypeBadge } from "@/components/ResourceTypeBadge";
import { getResourceScopeLabel } from "@/lib/resource-scope-labels";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LibraryPage,
});

const PAGE_SIZE = 24;

function LibraryPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(ALL_OPTION);
  const [sort, setSort] = useState<
  "newest" | "oldest" | "downloads" | "bookmarks"
>("newest");

  const [college, setCollege] = useState(ALL_OPTION);
  const [department, setDepartment] = useState(ALL_OPTION);
  const [level, setLevel] = useState(ALL_OPTION);
  const [semester, setSemester] = useState(ALL_OPTION);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const findResourcesRef = useRef<HTMLDivElement>(null);
  const previousPageRef = useRef(page);
  const pendingScrollRef = useRef(false);

  const departments =
    college === ALL_OPTION ? [] : getDepartments(college);

  const { canDownload } = useAccess();

  // Reset pagination whenever a filter or sort option changes.
    useEffect(() => {
    setPage(1);
  }, [
    q,
    category,
    college,
    department,
    level,
    semester,
    dateFrom,
    dateTo,
    sort,
  ]);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("deleted_at", null)
        .order("sort_order");

      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: libraryResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "library",
      q,
      category,
      college,
      department,
      level,
      semester,
      dateFrom,
      dateTo,
      sort,
      page,
      PAGE_SIZE,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_library_resources",
        {
          p_search: q.trim(),
          p_category_id: category,
          p_college: college,
          p_department: department,
          p_level: level,
          p_semester: semester,
          p_sort: sort,
          p_page_size: PAGE_SIZE,
          p_page: page,
          p_date_from: dateFrom || undefined,
          p_date_to: dateTo || undefined,
        },
      );

      if (error) throw error;

      const result = data as unknown as {
        totalCount: number;
        resources: ResourceRow[];
      };

      return {
        resources: Array.isArray(result?.resources)
          ? result.resources
          : [],
        totalCount: Number(result?.totalCount ?? 0),
      };
    },
  });

  const data = libraryResult?.resources ?? [];
  const totalCount = libraryResult?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const firstResult =
    totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(page * PAGE_SIZE, totalCount);

  // Remember when the page changes and scrolling is needed.
  useEffect(() => {
    if (previousPageRef.current === page) return;

    previousPageRef.current = page;
    pendingScrollRef.current = true;
  }, [page]);

 // Scroll to Find resources after the requested page loads.
useEffect(() => {
  if (
    !pendingScrollRef.current ||
    isLoading ||
    isError ||
    !libraryResult
  ) {
    return;
  }

  const target = findResourcesRef.current;

  if (!target) return;

  pendingScrollRef.current = false;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [page, isLoading, isError, libraryResult]);

    const hasActiveFilters =
    q.trim() !== "" ||
    category !== ALL_OPTION ||
    college !== ALL_OPTION ||
    department !== ALL_OPTION ||
    level !== ALL_OPTION ||
    semester !== ALL_OPTION ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sort !== "newest";

    const clearFilters = () => {
    setQ("");
    setCategory(ALL_OPTION);
    setCollege(ALL_OPTION);
    setDepartment(ALL_OPTION);
    setLevel(ALL_OPTION);
    setSemester(ALL_OPTION);
    setDateFrom("");
    setDateTo("");
    setSort("newest");
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          Library
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Browse approved resources
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Search, filter and download the collective
          knowledge of the community.
        </p>
      </div>

      {/* Filters */}
      <div
        ref={findResourcesRef}
        className="scroll-mt-21 rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
            />
          </div>

          {/* Category */}
          <div className="min-w-0">
            <Select
              value={category}
              onValueChange={setCategory}
            >
              <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={ALL_OPTION}>
                  All Categories
                </SelectItem>

                {cats?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
                value={college}
                onValueChange={(value) => {
                  setCollege(value);
                  setDepartment(ALL_OPTION);
                }}
              >
                <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                  <SelectValue placeholder="College" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_OPTION}>
                    All Colleges
                  </SelectItem>

                  {colleges.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <>
                        <span className="sm:hidden">
                          {item.id}
                        </span>

                        <span className="hidden sm:inline">
                          {item.name} ({item.id})
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
                value={department}
                onValueChange={setDepartment}
                disabled={college === ALL_OPTION}
              >
                <SelectTrigger
                  className={`h-9 text-xs sm:h-10 sm:text-sm ${
                    college === ALL_OPTION
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

                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
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
                value={level}
                onValueChange={setLevel}
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
                value={semester}
                onValueChange={setSemester}
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
<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">

  {/* Sort */}
  <div className="col-span-2 min-w-0 sm:col-span-1">
    <Select
      value={sort}
      onValueChange={(value) =>
        setSort(value as typeof sort)
      }
    >
      <SelectTrigger
        id="library-sort"
        className="h-10 w-full min-w-0 px-3 text-xs sm:text-sm"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
        <SelectItem value="downloads">
          Most downloaded
        </SelectItem>
        <SelectItem value="bookmarks">
          Most bookmarked
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Date from */}
  <div className="min-w-0">
    <input
      id="library-date-from"
      type="date"
      value={dateFrom}
      max={dateTo || undefined}
      onChange={(event) =>
        setDateFrom(event.target.value)
      }
      aria-label="Filter resources from this date"
      className="block h-10 w-full min-w-0 rounded-md border border-input bg-card px-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-2 sm:text-sm"
    />
  </div>

  {/* Date to */}
  <div className="min-w-0">
    <input
      id="library-date-to"
      type="date"
      value={dateTo}
      min={dateFrom || undefined}
      onChange={(event) =>
        setDateTo(event.target.value)
      }
      aria-label="Filter resources up to this date"
      className="block h-10 w-full min-w-0 rounded-md border border-input bg-card px-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-2 sm:text-sm"
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

      {/* Resource list */}
      <div>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-sm border border-border bg-card sm:h-48"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-sm border border-border bg-card p-5">
            <EmptyState
              title="Unable to load resources"
              desc="Please try again. If the problem continues, refresh the page."
            />
          </div>
        ) : data.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {data.map((resource) => (
              <ResourceCard
                key={resource.id}
                r={resource as unknown as ResourceRow}
                canDownload={canDownload}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-border bg-card">
            <EmptyState
              title="No resources found"
              desc="Try a different search or clear the filters."
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && totalCount > 0 && (
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
    </div>
  );
}

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  semester: string | null;
  year: number | null;
  tags: string[];
  category_id: string | null;
  download_count: number;
  bookmark_count: number;
  created_at: string;
  file_type: string | null;
  category_name: string | null;
  category_slug: string | null;
};

export function ResourceCard({
  r,
  canDownload,
}: {
  r: ResourceRow;
  canDownload: boolean;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [previewing, setPreviewing] = useState(false);

  const collegeLabel = getResourceScopeLabel(
  r.college,
  "college",
);

const collegeShort =
collegeLabel.match(/\((.*?)\)/)?.[1] ?? collegeLabel;

const departmentLabel = getResourceScopeLabel(
  r.department,
  "department",
);

const levelLabel = getResourceScopeLabel(
  r.level,
  "level",
);

const semesterLabel = getResourceScopeLabel(
  r.semester,
  "semester",
);

  const { data: bookmarked } = useQuery({
    queryKey: ["bookmarked", r.id, user?.id],
    enabled:
    !!user && profile?.primary_role !== "guest",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("resource_id", r.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Sign in required");
      }
       if (profile?.primary_role === "guest") {
        throw new Error("Guests cannot bookmark resources.");
      }

      if (bookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("resource_id", r.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({
            resource_id: r.id,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
onSuccess: () => {
  qc.invalidateQueries({
    queryKey: ["bookmarked", r.id],
  });

  qc.invalidateQueries({
    queryKey: ["library"],
  });

  qc.invalidateQueries({
    queryKey: ["bookmarks-list", user?.id],
  });
},
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update bookmark.",
      );
    },
  });

  const categoryName =
    r.category_name?.trim() || "Uncategorized";

  return (
    <article className="group flex flex-col rounded-sm border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant sm:p-5">
      <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
        <span className="min-w-0 flex-1 truncate text-[10px] uppercase font-medium text-gold sm:text-xs">
          {categoryName}
        </span>
        <div className="shrink-0">
          <ResourceTypeBadge
            filePath={r.file_type ? `.${r.file_type}` : ""}
          />
        </div>
      </div>
      <h3 className="line-clamp-2 font-display text-[13px] font-semibold leading-snug sm:text-lg">
        {r.title}
      </h3>

      {r.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
          {r.description}
        </p>
      )}

      <div className="mt-2.5 space-y-1.5 text-xs sm:mt-3 sm:space-y-2 sm:text-sm">
  {r.course_code && (
    <div className="flex items-center gap-2.5 text-muted-foreground sm:gap-3">
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
      <span>{r.course_code}</span>
    </div>
  )}

  {r.college && (
    <div className="flex items-center gap-2.5 text-muted-foreground sm:gap-3">
      <School className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
      <span>{collegeShort}</span>
    </div>
  )}

  {r.department && (
    <div className="flex items-center gap-2.5 text-muted-foreground sm:gap-3">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
      <span>{departmentLabel}</span>
    </div>
  )}

  {r.level && (
    <div className="flex items-center gap-2.5 text-muted-foreground sm:gap-3">
      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
      <span>{levelLabel}</span>
    </div>
  )}

  {r.semester && (
    <div className="flex items-center gap-2.5 text-muted-foreground sm:gap-3">
      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
      <span>{semesterLabel}</span>
    </div>
  )}
</div>

      <div className="mt-auto flex items-center justify-between pt-4 text-[10px] text-muted-foreground sm:pt-5 sm:text-xs">
        <span>
          {new Date(r.created_at).toLocaleDateString()}
        </span>

        <span className="inline-flex items-center gap-2.5 sm:gap-3">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" />
            {r.download_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {r.bookmark_count}
          </span>
        </span>
      </div>

      <div className="mt-3 flex gap-1.5 sm:mt-4 sm:gap-2">
        <div className="flex min-w-0 flex-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs sm:h-9 sm:text-sm bg-muted"
            disabled={previewing}
          >
            <Link
              to="/preview/$resourceId"
              params={{ resourceId: r.id }}
              onClick={() => setPreviewing(true)}
              className="flex items-center justify-center"
            >
              {previewing ? (
                <>
                  <Loader2 className="hidden h-3.5 w-3.5 animate-spin max-[320px]:block" />
                  <span className="block max-[320px]:hidden">
                    Previewing...
                  </span>
                </>
              ) : (
                <>
                  <Eye className="hidden h-3.5 w-3.5 max-[320px]:block" />
                  <span className="block max-[320px]:hidden">
                    Preview
                  </span>
                </>
              )}
            </Link>
          </Button>
        </div>

                {profile?.primary_role !== "guest" && (
          <Button
            className="h-8 shrink-0 px-2 sm:h-9 bg-muted"
            variant="outline"
            size="sm"
            onClick={() => toggleBookmark.mutate()}
            disabled={toggleBookmark.isPending}
            aria-label="Bookmark"
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${
                bookmarked
                  ? "text-yellow-500"
                  : "text-muted-foreground"
              }`}
              fill={bookmarked ? "currentColor" : "none"}
            />
          </Button>
        )}
      </div>
    </article>
  );
}