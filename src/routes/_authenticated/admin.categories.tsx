import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  FolderTree,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Tag,
  Trash2,
} from "lucide-react";
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
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  deleted_at: string | null;
};

type CategoryAuditLog = {
  id: string;
  category_id: string | null;
  action: string;
  performed_by: string | null;
  reason: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type ActorProfile = {
  id: string;
  full_name: string | null;
};

type PendingEdit = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

function CategoriesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [pendingEdit, setPendingEdit] =
    useState<PendingEdit | null>(null);

  const [editSummary, setEditSummary] = useState("");

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [deleteReason, setDeleteReason] = useState("");

  const [pendingRestore, setPendingRestore] =
    useState<Category | null>(null);

  const [expandedHistory, setExpandedHistory] =
    useState<string | null>(null);

  const hasAdminAccess =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!roles) {
      return;
    }

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

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select(
          "id, name, slug, description, sort_order, created_at, deleted_at",
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as Category[];
    },
  });

  const { data: resourceCategoryCounts } = useQuery({
    queryKey: ["admin-category-resource-counts"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("category_id");

      if (error) {
        throw error;
      }

      const counts: Record<string, number> = {};

      for (const resource of data ?? []) {
        if (!resource.category_id) {
          continue;
        }

        counts[resource.category_id] =
          (counts[resource.category_id] ?? 0) + 1;
      }

      return counts;
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["admin-category-audit-logs"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_audit_logs")
        .select(
          "id, category_id, action, performed_by, reason, old_data, new_data, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as CategoryAuditLog[];
    },
  });

  const actorIds = Array.from(
    new Set(
      (auditLogs ?? [])
        .map((log) => log.performed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: actorProfiles } = useQuery({
    queryKey: ["admin-category-audit-actors", actorIds],
    enabled: actorIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_profiles")
        .select("id, full_name")
        .in("id", actorIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as ActorProfile[];
    },
  });

  const actorMap = new Map(
    (actorProfiles ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || "Unknown user",
    ]),
  );

  const activeCategories =
    categories?.filter((category) => !category.deleted_at) ?? [];

  const deletedCategories =
    categories?.filter((category) => category.deleted_at) ?? [];

  const create = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedSlug = slug.trim().toLowerCase();
      const trimmedDescription = description.trim();

      if (!trimmedName || !trimmedSlug) {
        throw new Error(
          "Category name and slug are required.",
        );
      }

      const allCategories = categories ?? [];

      const activeNameExists = allCategories.some(
        (category) =>
          !category.deleted_at &&
          category.name.toLowerCase() ===
            trimmedName.toLowerCase(),
      );

      if (activeNameExists) {
        throw new Error(
          "An active category with this name already exists.",
        );
      }

      const activeSlugExists = allCategories.some(
        (category) =>
          !category.deleted_at &&
          category.slug.toLowerCase() === trimmedSlug,
      );

      if (activeSlugExists) {
        throw new Error(
          "An active category with this slug already exists.",
        );
      }

      const deletedMatch = allCategories.find(
        (category) =>
          category.deleted_at &&
          (category.name.toLowerCase() ===
            trimmedName.toLowerCase() ||
            category.slug.toLowerCase() === trimmedSlug),
      );

      if (deletedMatch) {
        throw new Error(
          `A deleted category named "${deletedMatch.name}" already exists. Restore it from Deleted Categories instead of creating a new category.`,
        );
      }

      const { error } = await supabase
        .from("categories")
        .insert({
          name: trimmedName,
          slug: trimmedSlug,
          description: trimmedDescription || null,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      setName("");
      setSlug("");
      setDescription("");

      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-audit-logs"],
      });

      toast.success("Category created successfully.");
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      name: nextName,
      slug: nextSlug,
      description: nextDescription,
      summary,
    }: {
      id: string;
      name: string;
      slug: string;
      description: string;
      summary: string;
    }) => {
      const trimmedName = nextName.trim();
      const trimmedSlug = nextSlug.trim().toLowerCase();
      const trimmedDescription = nextDescription.trim();
      const trimmedSummary = summary.trim();

      if (!trimmedName || !trimmedSlug) {
        throw new Error(
          "Category name and slug are required.",
        );
      }

      if (!trimmedSummary) {
        throw new Error(
          "An edit summary is required when making changes.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_update_category",
        {
          _category_id: id,
          _name: trimmedName,
          _slug: trimmedSlug,
          _description: trimmedDescription,
          _edit_summary: trimmedSummary,
        },
      );

      if (error) {
        throw error;
      }

      const result = data as {
        id?: string;
        changed?: boolean;
      } | null;

      if (!result?.id) {
        throw new Error(
          "Category could not be updated. It may no longer exist or you may not have permission.",
        );
      }

      return {
        id: result.id,
        changed: result.changed === true,
      };
    },

    onSuccess: (result) => {
      setEditingCategory(null);
      setPendingEdit(null);
      setEditSummary("");

      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-audit-logs"],
      });

      if (result.changed) {
        toast.success(
          "Category updated and edit history recorded.",
        );
      } else {
        toast.success("No changes were made.");
      }
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reorder = useMutation({
    mutationFn: async ({
      categoryId,
      direction,
    }: {
      categoryId: string;
      direction: "up" | "down";
    }) => {
      const currentCategories = [...activeCategories];

      const currentIndex = currentCategories.findIndex(
        (category) => category.id === categoryId,
      );

      if (currentIndex === -1) {
        throw new Error("Category could not be found.");
      }

      const targetIndex =
        direction === "up"
          ? currentIndex - 1
          : currentIndex + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= currentCategories.length
      ) {
        return;
      }

      const current = currentCategories[currentIndex];
      const target = currentCategories[targetIndex];

      const { error: firstError } = await supabase
        .from("categories")
        .update({
          sort_order: target.sort_order,
        })
        .eq("id", current.id)
        .is("deleted_at", null);

      if (firstError) {
        throw firstError;
      }

      const { error: secondError } = await supabase
        .from("categories")
        .update({
          sort_order: current.sort_order,
        })
        .eq("id", target.id)
        .is("deleted_at", null);

      if (secondError) {
        throw secondError;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-audit-logs"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const del = useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: string;
      reason: string;
    }) => {
      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_delete_category",
        {
          _category_id: id,
          _deletion_reason: trimmedReason,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || data !== id) {
        throw new Error(
          "Category could not be deleted. It may no longer exist or you may not have permission.",
        );
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-resource-counts"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-audit-logs"],
      });

      setPendingDelete(null);
      setDeleteReason("");

      toast.success("Category deleted successfully.");
    },

    onError: (error: Error) => {
      setPendingDelete(null);
      setDeleteReason("");

      toast.error(error.message);
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc(
        "admin_restore_category",
        {
          _category_id: id,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || data !== id) {
        throw new Error(
          "Category could not be restored. It may no longer exist or may already be active.",
        );
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-resource-counts"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-category-audit-logs"],
      });

      setPendingRestore(null);

      toast.success(
        "Category restored successfully. Existing resources remain linked to it.",
      );
    },

    onError: (error: Error) => {
      setPendingRestore(null);
      toast.error(error.message);
    },
  });

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditDescription(category.description ?? "");
    setPendingEdit(null);
    setEditSummary("");
  };

  const closeEditDialog = () => {
    if (update.isPending) {
      return;
    }

    setEditingCategory(null);
    setPendingEdit(null);
    setEditSummary("");
  };

  const prepareEdit = () => {
    if (!editingCategory) {
      return;
    }

    const trimmedName = editName.trim();
    const trimmedSlug = editSlug.trim().toLowerCase();
    const trimmedDescription = editDescription.trim();

    if (!trimmedName || !trimmedSlug) {
      toast.error(
        "Category name and slug are required.",
      );
      return;
    }

    const originalName = editingCategory.name.trim();
    const originalSlug =
      editingCategory.slug.trim().toLowerCase();
    const originalDescription =
      editingCategory.description?.trim() ?? "";

    const hasChanges =
      originalName !== trimmedName ||
      originalSlug !== trimmedSlug ||
      originalDescription !== trimmedDescription;

    if (!hasChanges) {
      setEditingCategory(null);
      toast.success("No changes were made.");
      return;
    }

    setPendingEdit({
      id: editingCategory.id,
      name: trimmedName,
      slug: trimmedSlug,
      description: trimmedDescription,
    });

    setEditSummary("");
    setEditingCategory(null);
  };

  const closeEditConfirmation = () => {
    if (update.isPending) {
      return;
    }

    setPendingEdit(null);
    setEditSummary("");
  };

  const confirmEdit = () => {
    if (!pendingEdit) {
      return;
    }

    const trimmedSummary = editSummary.trim();

    if (!trimmedSummary) {
      toast.error(
        "An edit summary is required.",
      );
      return;
    }

    update.mutate({
      id: pendingEdit.id,
      name: pendingEdit.name,
      slug: pendingEdit.slug,
      description: pendingEdit.description,
      summary: trimmedSummary,
    });
  };

  const handleDelete = (
    id: string,
    categoryName: string,
  ) => {
    setPendingDelete({
      id,
      name: categoryName,
    });

    setDeleteReason("");
  };

  const closeDeleteDialog = () => {
    if (del.isPending) {
      return;
    }

    setPendingDelete(null);
    setDeleteReason("");
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const trimmedReason = deleteReason.trim();

    if (!trimmedReason) {
      toast.error("A deletion reason is required.");
      return;
    }

    del.mutate({
      id: pendingDelete.id,
      reason: trimmedReason,
    });
  };

  const confirmRestore = () => {
    if (!pendingRestore) {
      return;
    }

    restore.mutate(pendingRestore.id);
  };

  const getCategoryHistory = (categoryId: string) =>
    (auditLogs ?? []).filter(
      (log) => log.category_id === categoryId,
    );

  const getActorLabel = (performedBy: string | null) => {
    if (!performedBy) {
      return "System / SQL Editor";
    }

    return actorMap.get(performedBy) ?? "Unknown user";
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "created":
        return "Created";
      case "updated":
        return "Updated";
      case "reordered":
        return "Reordered";
      case "deleted":
        return "Deleted";
      case "restored":
        return "Restored";
      default:
        return action;
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const deleteLoading = del.isPending;
  const restoreLoading = restore.isPending;
  const updateLoading = update.isPending;
  const deleteReasonMissing = !deleteReason.trim();
  const editSummaryMissing = !editSummary.trim();

  /*
   * Keep the component mounted only while the current user still
   * has administrator-level access. This prevents stale category
   * content from remaining visible after the user's role changes.
   */
  if (
    currentUser &&
    roles &&
    !hasAdminAccess
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-3 sm:px-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="space-y-5 sm:space-y-8">
        {/* Create category */}
        <div className="rounded-sm border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="mb-3 flex items-center gap-1.5 sm:mb-4 sm:gap-2">
            <div>
              <p className="text-xs font-semibold sm:text-sm">
                Create category
              </p>

              <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
                Add a new classification for library resources.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground sm:text-xs"
                >
                  Category name
                </label>

                <Input
                  id="category-name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. Handouts"
                  disabled={create.isPending}
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="category-slug"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground sm:text-xs"
                >
                  Slug
                </label>

                <Input
                  id="category-slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value)
                  }
                  placeholder="e.g. handouts"
                  disabled={create.isPending}
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="category-description"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground sm:text-xs"
                >
                  Description
                </label>

                <Input
                  id="category-description"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Optional category description"
                  disabled={create.isPending}
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
  type="submit"
  variant="ghost"
  disabled={create.isPending}
  className="h-9 w-full bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:w-auto sm:text-sm"
>
  {create.isPending && (
    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
  )}

  {create.isPending
    ? "Creating…"
    : "Create category"}
</Button>
            </div>
          </form>
        </div>

        {/* Active categories */}
        <div className="rounded-sm border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <FolderTree className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />

              <p className="text-xs font-semibold sm:text-sm text-muted-foreground">
                Active categories
              </p>
            </div>

            {categories && (
              <span className="text-[10px] text-muted-foreground sm:text-xs">
                {activeCategories.length} active
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground sm:py-10 sm:text-sm">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                Loading categories…
              </div>
            </div>
          ) : activeCategories.length > 0 ? (
            <div>
              <ul className="divide-y divide-border">
                {activeCategories.map((category, index) => {
                  const isDeleting =
                    del.isPending &&
                    del.variables?.id === category.id;

                  const isReordering =
                    reorder.isPending &&
                    reorder.variables?.categoryId ===
                      category.id;

                  const history = getCategoryHistory(
                    category.id,
                  );

                  const isHistoryOpen =
                    expandedHistory === category.id;

                  return (
                    <li
                      key={category.id}
                      className="py-3 sm:py-4"
                    >
                      <div className="flex items-start justify-between gap-2.5 sm:gap-4">
                        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted/30 text-[10px] font-medium text-muted-foreground sm:h-8 sm:w-8 sm:text-xs">
                            {String(index + 1).padStart(
                              2,
                              "0",
                            )}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold sm:text-sm">
                              {category.name}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:gap-x-3 sm:gap-y-1 sm:text-xs">
                              <span className="flex items-center gap-1">
                                <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                /{category.slug}
                              </span>

                              <span>
                                {resourceCategoryCounts?.[
                                  category.id
                                ] ?? 0}{" "}
                                resources
                              </span>
                            </div>

                            {category.description && (
                              <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground sm:mt-2 sm:text-xs sm:leading-normal">
                                {category.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0 sm:gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-9 sm:w-9"
                            disabled={
                              isReordering ||
                              reorder.isPending ||
                              index === 0
                            }
                            onClick={() =>
                              reorder.mutate({
                                categoryId: category.id,
                                direction: "up",
                              })
                            }
                            aria-label={`Move ${category.name} up`}
                          >
                            {isReordering &&
                            reorder.variables?.direction ===
                              "up" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                            ) : (
                              <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-9 sm:w-9"
                            disabled={
                              isReordering ||
                              reorder.isPending ||
                              index ===
                                activeCategories.length - 1
                            }
                            onClick={() =>
                              reorder.mutate({
                                categoryId: category.id,
                                direction: "down",
                              })
                            }
                            aria-label={`Move ${category.name} down`}
                          >
                            {isReordering &&
                            reorder.variables?.direction ===
                              "down" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-9 sm:w-9"
                            disabled={
                              updateLoading ||
                              del.isPending
                            }
                            onClick={() =>
                              openEditDialog(category)
                            }
                            aria-label={`Edit ${category.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive sm:h-9 sm:w-9"
                            disabled={
                              del.isPending ||
                              updateLoading
                            }
                            onClick={() =>
                              handleDelete(
                                category.id,
                                category.name,
                              )
                            }
                            aria-label={`Delete ${category.name}`}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2.5 ml-9 sm:mt-3 sm:ml-11">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedHistory(
                              isHistoryOpen
                                ? null
                                : category.id,
                            )
                          }
                          className="h-7 px-1.5 text-[10px] text-gold sm:px-2 sm:text-xs"
                        >
                          <History className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />

                          {isHistoryOpen
                            ? "Hide history"
                            : `History (${history.length})`}
                        </Button>

                        {isHistoryOpen && (
                          <div className="mt-2 border-l border-border pl-3 sm:pl-4">
                            {history.length > 0 ? (
                              <div className="space-y-2.5 sm:space-y-3">
                                {history.map((log) => (
                                  <div
                                    key={log.id}
                                    className="text-[10px] leading-4 sm:text-xs sm:leading-normal"
                                  >
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-y-1">
                                      <span className="font-medium">
                                        {getActionLabel(
                                          log.action,
                                        )}
                                      </span>

                                      <span className="text-muted-foreground">
                                        {formatDate(
                                          log.created_at,
                                        )}
                                      </span>
                                    </div>

                                    <p className="mt-0.5 text-muted-foreground">
                                      By{" "}
                                      <span className="font-medium text-foreground">
                                        {getActorLabel(
                                          log.performed_by,
                                        )}
                                      </span>
                                    </p>

                                    {log.reason && (
                                      <p className="mt-1 text-muted-foreground">
                                        {log.action ===
                                        "updated"
                                          ? `Edit summary: ${log.reason}`
                                          : `Reason: ${log.reason}`}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="py-2 text-[10px] text-muted-foreground sm:text-xs">
                                No audit history yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="py-10 text-center sm:py-12">
              <FolderTree className="mx-auto h-7 w-7 text-muted-foreground/50 sm:h-8 sm:w-8" />

              <p className="mt-2.5 text-xs font-medium sm:mt-3 sm:text-sm">
                No active categories
              </p>

              <p className="mt-1 px-4 text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
                Create your first category above to organize resources.
              </p>
            </div>
          )}
        </div>

        {/* Deleted categories */}
          {deletedCategories.length > 0 && (
          <div className="rounded-sm border border-border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Trash2 className="h-3.5 w-3.5 text-destructive sm:h-4 sm:w-4" />

                <p className="text-xs font-semibold sm:text-sm text-destructive">
                  Deleted categories
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground sm:text-xs">
                {deletedCategories.length} deleted
              </span>
            </div>

            <div>
              <ul className="divide-y divide-border">
                {deletedCategories.map((category) => {
                  const history = getCategoryHistory(
                    category.id,
                  );

                  const isHistoryOpen =
                    expandedHistory === category.id;

                  const isRestoring =
                    restore.isPending &&
                    restore.variables === category.id;

                  const deletedLog = [...history]
                    .reverse()
                    .find(
                      (log) => log.action === "deleted",
                    );

                  return (
                    <li
                      key={category.id}
                      className="py-3 sm:py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">
                            {category.name}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:gap-x-3 sm:gap-y-1 sm:text-xs">
                            <span className="flex items-center gap-1">
                              <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              /{category.slug}
                            </span>

                            {category.deleted_at && (
                              <span>
                                Deleted{" "}
                                {formatDate(
                                  category.deleted_at,
                                )}
                              </span>
                            )}
                          </div>

                          {deletedLog?.performed_by && (
                            <p className="mt-1.5 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
                              Deleted by{" "}
                              <span className="font-medium text-foreground">
                                {getActorLabel(
                                  deletedLog.performed_by,
                                )}
                              </span>
                            </p>
                          )}

                          {deletedLog?.reason && (
                            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                              Reason: {deletedLog.reason}
                            </p>
                          )}

                          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground sm:mt-2 sm:text-xs sm:leading-normal">
                            Existing resources remain linked to
                            this category and will regain its
                            name when restored.
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            restore.isPending ||
                            del.isPending
                          }
                          onClick={() =>
                            setPendingRestore(category)
                          }
                          className="h-8 w-full shrink-0 text-[10px] sm:h-9 sm:w-auto sm:text-xs bg-muted"
                        >
                          {isRestoring ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}

                          Restore
                        </Button>
                      </div>

                      
<div className="mt-2.5 sm:mt-3">
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={() =>
      setExpandedHistory(
        isHistoryOpen ? null : category.id,
      )
    }
    className="h-7 px-1.5 text-[10px] text-gold sm:px-2 sm:text-xs"
  >
    <History className="mr-1 h-3 w-3 text-gold sm:mr-1.5 sm:h-3.5 sm:w-3.5" />

    {isHistoryOpen
      ? "Hide history"
      : `History (${history.length})`}
  </Button>


                        {isHistoryOpen && (
                          <div className="mt-2 border-l border-border pl-3 sm:pl-4">
                            {history.length > 0 ? (
                              <div className="space-y-2.5 sm:space-y-3">
                                {history.map((log) => (
                                  <div
                                    key={log.id}
                                    className="text-[10px] leading-4 sm:text-xs sm:leading-normal"
                                  >
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-y-1">
                                      <span className="font-medium">
                                        {getActionLabel(
                                          log.action,
                                        )}
                                      </span>

                                      <span className="text-muted-foreground">
                                        {formatDate(
                                          log.created_at,
                                        )}
                                      </span>
                                    </div>

                                    <p className="mt-0.5 text-muted-foreground">
                                      By{" "}
                                      <span className="font-medium text-foreground">
                                        {getActorLabel(
                                          log.performed_by,
                                        )}
                                      </span>
                                    </p>

                                    {log.reason && (
                                      <p className="mt-1 text-muted-foreground">
                                        {log.action ===
                                        "updated"
                                          ? `Edit summary: ${log.reason}`
                                          : `Reason: ${log.reason}`}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="py-2 text-[10px] text-muted-foreground sm:text-xs">
                                No audit history yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Edit category dialog */}
      <AlertDialog
        open={editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Edit category
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Update the category details. Changes are recorded
              in the category audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label
                htmlFor="edit-category-name"
                className="mb-1.5 block text-xs font-medium sm:text-sm"
              >
                Category name
              </label>

              <Input
                id="edit-category-name"
                value={editName}
                onChange={(e) =>
                  setEditName(e.target.value)
                }
                disabled={updateLoading}
                className="h-9 text-xs sm:h-10 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="edit-category-slug"
                className="mb-1.5 block text-xs font-medium sm:text-sm"
              >
                Slug
              </label>

              <Input
                id="edit-category-slug"
                value={editSlug}
                onChange={(e) =>
                  setEditSlug(e.target.value)
                }
                disabled={updateLoading}
                className="h-9 text-xs sm:h-10 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="edit-category-description"
                className="mb-1.5 block text-xs font-medium sm:text-sm"
              >
                Description
              </label>

              <Input
                id="edit-category-description"
                value={editDescription}
                onChange={(e) =>
                  setEditDescription(e.target.value)
                }
                disabled={updateLoading}
                className="h-9 text-xs sm:h-10 sm:text-sm"
              />
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={updateLoading}
              onClick={closeEditDialog}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                prepareEdit();
              }}
              disabled={
                updateLoading ||
                !editName.trim() ||
                !editSlug.trim()
              }
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Review changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit summary confirmation */}
      <AlertDialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditConfirmation();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Confirm category changes
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              You are about to update{" "}
              <strong>{pendingEdit?.name}</strong>. Enter a
              summary explaining what was changed, then confirm
              the update.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="category-edit-summary"
              className="text-xs font-medium sm:text-sm"
            >
              Edit Summary
            </label>

            <Input
              id="category-edit-summary"
              value={editSummary}
              onChange={(e) =>
                setEditSummary(e.target.value)
              }
              placeholder="e.g. Corrected category name and updated slug"
              disabled={updateLoading}
              autoFocus
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              This summary will be permanently recorded in the
              category audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={updateLoading}
              onClick={closeEditConfirmation}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmEdit();
              }}
              disabled={
                updateLoading ||
                editSummaryMissing
              }
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              {updateLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {updateLoading
                ? "Saving…"
                : "Confirm & save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Delete category?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Are you sure you want to delete{" "}
              <strong>{pendingDelete?.name}</strong>? The
              category will be moved to Deleted Categories rather
              than permanently removed. Resources assigned to it
              will remain linked and can recover the category name
              when it is restored.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="category-deletion-reason"
              className="text-xs font-medium sm:text-sm"
            >
              Deletion reason
            </label>

            <Input
              id="category-deletion-reason"
              value={deleteReason}
              onChange={(e) =>
                setDeleteReason(e.target.value)
              }
              placeholder="e.g. Duplicate category"
              disabled={deleteLoading}
              autoFocus
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              A reason is required and will be recorded in the
              category audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={deleteLoading}
              onClick={closeDeleteDialog}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={
                deleteLoading ||
                deleteReasonMissing
              }
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:h-10 sm:text-sm"
            >
              {deleteLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {deleteLoading
                ? "Deleting…"
                : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation */}
      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open && !restore.isPending) {
            setPendingRestore(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Restore category?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Restore{" "}
              <strong>{pendingRestore?.name}</strong>? The
              original category will become active again using the
              same category ID. Resources that were assigned to it
              before deletion will continue to use this category.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={restoreLoading}
              onClick={() =>
                setPendingRestore(null)
              }
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmRestore();
              }}
              disabled={restoreLoading}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            >
              {restoreLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {restoreLoading
                ? "Restoring…"
                : "Restore category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
