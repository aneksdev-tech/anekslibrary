import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Edit3,
  Filter,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { requireRole } from "@/lib/route-guards";
import {
  EmptyState,
  StatusPill,
} from "./dashboard";

export const Route = createFileRoute(
  "/_authenticated/my-uploads",
)({
  beforeLoad: async () => {
    await requireRole([
      "admin",
      "co-admin",
      "lecturer",
      "staff",
      "student",
      "researcher",
    ]);
  },
  head: () => ({
    meta: [
      {
        title: "My Uploads | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: MyUploads,
});

type SortOption =
  | "newest"
  | "oldest"
  | "status";

type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

type UploadCategory = {
  id: string;
  name: string;
  deleted_at: string | null;
};

type UploadResource = {
  id: string;
  title: string;
  status: string;
  rejection_reason: string | null;
  deletion_reason: string | null;
  download_count: number;
  created_at: string;
  category: {
    name: string | null;
    deleted_at: string | null;
  } | null;
};

type MyUploadsResponse = {
  totalCount: number;
  resources: UploadResource[];
};

const PAGE_SIZE = 20;

const STATUS_ORDER: Record<string, number> = {
  pending: 1,
  approved: 2,
  rejected: 3,
  deleted: 4,
  draft: 5,
};

function MyUploads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] =
    useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  const [pendingDelete, setPendingDelete] =
    useState<{
      id: string;
      title: string;
    } | null>(null);

  const [deletingDraftId, setDeletingDraftId] =
    useState<string | null>(null);

  // Debounce search input to avoid a database request
  // for every keystroke.
  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  // Changing a filter or sort order starts from page 1.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    statusFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ["my-uploads-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, deleted_at")
        .order("name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as UploadCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: uploadsResponse,
    isLoading,
    isFetching,
    error: uploadsError,
  } = useQuery({
    queryKey: [
      "my-uploads",
      user?.id,
      debouncedSearch,
      statusFilter,
      categoryFilter,
      dateFrom,
      dateTo,
      sortBy,
      page,
      PAGE_SIZE,
    ],
    enabled: !!user,
    queryFn: async (): Promise<MyUploadsResponse> => {
      if (!user) {
        throw new Error(
          "You must be signed in to view your uploads.",
        );
      }

      const { data, error } = await supabase.rpc(
        "get_my_uploads",
        {
          p_search: debouncedSearch,
          p_status: statusFilter,
          p_category_id: categoryFilter,
          p_date_from: dateFrom || undefined,
          p_date_to: dateTo || undefined,
          p_sort: sortBy,
          p_page_size: PAGE_SIZE,
          p_page: page,
        },
      );

      if (error) {
        throw error;
      }

      const response = data as unknown as
        | MyUploadsResponse
        | null;

      return {
        totalCount: Number(
          response?.totalCount ?? 0,
        ),
        resources: Array.isArray(
          response?.resources,
        )
          ? response.resources
          : [],
      };
    },
    placeholderData: (previousData) =>
      previousData,
  });

  const resources =
    uploadsResponse?.resources ?? [];

  const totalCount =
    uploadsResponse?.totalCount ?? 0;

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const handleDeleteDraft = async () => {
    if (!user || !pendingDelete) {
      return;
    }

    const draftId = pendingDelete.id;

    setDeletingDraftId(draftId);

    try {
      const {
        data: draft,
        error: draftError,
      } = await supabase
        .from("resources")
        .select("id, file_path")
        .eq("id", draftId)
        .eq("uploader_id", user.id)
        .eq("status", "draft")
        .maybeSingle();

      if (draftError) {
        throw draftError;
      }

      if (!draft) {
        throw new Error(
          "Draft not found.",
        );
      }

      if (draft.file_path) {
        const {
          error: storageError,
        } = await supabase.storage
          .from("resources")
          .remove([draft.file_path]);

        if (storageError) {
          throw storageError;
        }
      }

      const {
        data: deletedDraft,
        error: deleteError,
      } = await supabase
        .from("resources")
        .delete()
        .eq("id", draftId)
        .eq("uploader_id", user.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (deleteError) {
        throw deleteError;
      }

      if (!deletedDraft) {
        throw new Error(
          "Draft could not be deleted. It may no longer exist or may have changed.",
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["my-uploads", user.id],
      });

      toast.success(
        "Draft deleted successfully.",
      );

      setPendingDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete draft.",
      );
    } finally {
      setDeletingDraftId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "newest";

  const dateRangeInvalid =
    dateFrom !== "" &&
    dateTo !== "" &&
    dateFrom > dateTo;

  const handleDateFromChange = (
    value: string,
  ) => {
    setDateFrom(value);

    if (dateTo && value && value > dateTo) {
      setDateTo("");
    }
  };

  const handleDateToChange = (
    value: string,
  ) => {
    setDateTo(value);

    if (dateFrom && value && value < dateFrom) {
      setDateFrom("");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          My uploads
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Manage your contributions
        </h1>
      </div>

      {/* Filters */}
      <div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />

          <p className="text-xs font-semibold sm:text-sm">
            Find uploads
          </p>
        </div>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search uploads by title..."
              aria-label="Search uploads by title"
              className="h-10 w-full rounded-sm border border-input bg-card pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm"
            />
          </div>

          {/* Status and category */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <div className="min-w-0">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger
                  id="upload-status"
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    All statuses
                  </SelectItem>
                  <SelectItem value="pending">
                    Pending
                  </SelectItem>
                  <SelectItem value="approved">
                    Approved
                  </SelectItem>
                  <SelectItem value="rejected">
                    Rejected
                  </SelectItem>
                  <SelectItem value="deleted">
                    Deleted
                  </SelectItem>
                  <SelectItem value="draft">
                    Draft
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                disabled={categoriesLoading}
              >
                <SelectTrigger
                  id="upload-category"
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                >
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    All categories
                  </SelectItem>

                  {categories
                    .filter(
                      (category) =>
                        category.deleted_at == null,
                    )
                    .map((category) => (
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
          </div>
        </div>
        
{/* Sorting and date range */}
<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">

  {/* Sort */}
  <div className="col-span-2 min-w-0 sm:col-span-1">
    <Select
      value={sortBy}
      onValueChange={(value) =>
        setSortBy(value as SortOption)
      }
    >
      <SelectTrigger
        id="upload-sort"
        className="h-10 w-full min-w-0 px-3 text-xs sm:text-sm"
      >
        <SelectValue placeholder="Newest first" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
        <SelectItem value="status">Status</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Date from */}
  <div className="min-w-0">
    <input
      id="upload-date-from"
      type="date"
      value={dateFrom}
      max={dateTo || undefined}
      onChange={(event) =>
        setDateFrom(event.target.value)
      }
      aria-label="Filter uploads from this date"
      className="block h-10 w-full min-w-0 rounded-md border border-input bg-card px-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-2 sm:text-sm"
    />
  </div>

  {/* Date to */}
  <div className="min-w-0">
    <input
      id="upload-date-to"
      type="date"
      value={dateTo}
      min={dateFrom || undefined}
      onChange={(event) =>
        setDateTo(event.target.value)
      }
      aria-label="Filter uploads up to this date"
      className="block h-10 w-full min-w-0 rounded-md border border-input bg-card px-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-2 sm:text-sm"
    />
  </div>
</div>

         {/* Filter footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="ml-2 mt-3 text-[10px] font-medium text-gold sm:text-xs">
              {totalCount > 0
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    totalCount,
                  )} of ${totalCount} uploads`
                : "0 uploads"}
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-3 mt-3 pr-3 inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-gold transition-opacity hover:opacity-75 sm:gap-1.5 sm:text-xs"
              >
                <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Clear filters
              </button>
            )}
          </div>
          {dateRangeInvalid && (
          <p className="mt-2 text-xs text-destructive">
            The start date must not be later than the end date.
          </p>
        )}
      </div>
      
      {/* Upload list */}
      <div className="rounded-sm border border-border bg-card py-1 px-4 shadow-soft">
        {isLoading ? (
          <div className="grid min-h-[30vh] place-items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading uploads…
            </div>
          </div>
        ) : uploadsError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-destructive">
              Could not load your uploads.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {uploadsError instanceof Error
                ? uploadsError.message
                : "Please try again."}
            </p>

            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["my-uploads", user?.id],
                })
              }
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : resources.length > 0 ? (
          <>
            {isFetching && (
              <div className="flex items-center gap-2 border-b border-border py-2 text-[10px] text-muted-foreground sm:text-xs">
                <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                Updating results…
              </div>
            )}

            <ul className="divide-y divide-border">
              {resources.map((resource) => {
                const categoryName =
                  resource.category?.deleted_at == null &&
                  resource.category?.name?.trim()
                    ? resource.category.name.trim()
                    : "Uncategorized";

                return (
                  <li
                    key={resource.id}
                    className="group py-4 sm:py-5"
                  >
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5">
                          <StatusPill
                            status={resource.status}
                          />
                        </div>
                        <p
                        className={
                            resource.status === "draft"
                              ? "truncate text-sm font-medium sm:text-base"
                              : "break-words text-sm font-medium sm:text-base"
                          }
                        >
                          {resource.title}
                        </p>                        
                          <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                          {categoryName}
                          {" · "}
                          {resource.download_count ?? 0}
                          {" downloads · "}
                          {new Date(
                            resource.created_at,
                          ).toLocaleDateString()}
                        </p>
                        {(resource.status === "rejected" ||
  resource.status === "deleted") &&
  (resource.status === "rejected"
    ? resource.rejection_reason
    : resource.deletion_reason) && (
    <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
      <span className="font-medium text-foreground">
        Reason:
      </span>{" "}
      {resource.status === "rejected"
        ? resource.rejection_reason
        : resource.deletion_reason}
    </p>
  )}
  </div>
                       {resource.status === "draft" && (
                        <div className="flex shrink-0 flex-col gap-2">
                          <Link
                            to="/upload/$draftId"
                            params={{
                              draftId: resource.id,
                            }}
                            className="inline-flex h-9 w-16 items-center justify-center rounded-sm border border-border bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                          >
                            Edit
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                id: resource.id,
                                title: resource.title,
                              })
                            }
                            disabled={
                              deletingDraftId === resource.id
                            }
                            className="inline-flex h-9 w-16 items-center justify-center rounded-sm border border-border bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                          >
                            {deletingDraftId === resource.id
                              ? "Deleting…"
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <EmptyState
            title="No uploads found"
            desc={
              hasActiveFilters
                ? "No uploads match your search and selected filters. Try adjusting them or clearing the filters."
                : "You have not uploaded any resources yet."
            }
          />
        )}
      </div>

      {/* Pagination */}
      {!isLoading &&
      !uploadsError &&
        totalCount >= PAGE_SIZE && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="justify-self-start">
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                disabled={page <= 1 || isFetching}
                className="inline-flex h-8 items-center justify-center rounded-sm border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:px-3 sm:text-sm"
              >
                Previous
              </button>
            </div>

            <p
              className="whitespace-nowrap text-center text-[10px] text-muted-foreground sm:text-sm"
              aria-live="polite"
            >
              Page {page} of {totalPages}
            </p>

            <div className="justify-self-end">
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
                disabled={
                  page >= totalPages || isFetching
                }
                className="inline-flex h-8 items-center justify-center rounded-sm border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:px-3 sm:text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDraftId) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete draft?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-sm">
              Delete{" "}
              <strong>{pendingDelete?.title}</strong>
              ? This will permanently remove the draft
              and its attached file. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={deletingDraftId !== null}
              className="items-center justify-center rounded-sm border border-border bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteDraft();
              }}
              disabled={deletingDraftId !== null}
              className="items-center justify-center rounded-sm border border-border bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              {deletingDraftId !== null && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}