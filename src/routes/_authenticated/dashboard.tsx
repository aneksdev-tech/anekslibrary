import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ArrowUpRight,
  Bookmark,
  Download,
  Edit3,
  FileCheck2,
  Loader2,
  Trash2,
  Upload,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContributorLevel,
  getLevelProgress,
  getNextContributorLevel,
} from "@/lib/reputation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import type { ReactNode } from "react";
import { useState } from "react";
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

export const Route = createFileRoute(
  "/_authenticated/dashboard",
)({
  head: () => ({
    meta: [
      { title: "Dashboard | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type RecentUpload = {
  id: string;
  title: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  download_count: number;
  category?: {
    name?: string | null;
    slug?: string | null;
    deleted_at?: string | null;
  } | null;
};

function DashboardPage() {
  const { profile, user, roles } =
    useAuth();

  const isGuest =
    profile?.primary_role === "guest" ||
    roles.includes("guest");

  const queryClient =
    useQueryClient();

  const [pendingDelete, setPendingDelete] =
    useState<{
      id: string;
      title: string;
    } | null>(null);

  const [deletingDraftId, setDeletingDraftId] =
    useState<string | null>(null);

  const { data: stats } =
    useQuery({
      queryKey: [
        "dash-stats",
        user?.id,
      ],
      enabled: !!user && !isGuest,
      queryFn: async () => {
        const [
          uploads,
          downloads,
          bookmarks,
          approved,
        ] = await Promise.all([
          supabase
            .from("resources")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "uploader_id",
              user!.id,
            )
            .neq(
              "status",
              "deleted",
            ),

          supabase
            .from("downloads")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "user_id",
              user!.id,
            ),

          supabase
            .from("bookmarks")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "user_id",
              user!.id,
            ),

          supabase
            .from("resources")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "uploader_id",
              user!.id,
            )
            .eq(
              "status",
              "approved",
            ),
        ]);

        return {
          uploads:
            uploads.count ?? 0,
          downloads:
            downloads.count ?? 0,
          bookmarks:
            bookmarks.count ?? 0,
          approved:
            approved.count ?? 0,
        };
      },
    });

  const { data: recent } =
    useQuery({
      queryKey: [
        "recent-uploads",
        user?.id,
      ],
      enabled: !!user && !isGuest,
      queryFn: async () => {
        const {
          data,
          error,
        } = await supabase
          .from("resources")
          .select(
            "id, title, status, rejection_reason, created_at, download_count, category:categories(name, slug, deleted_at)",
          )
          .eq(
            "uploader_id",
            user!.id,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(5);

        if (error) {
          throw error;
        }

        return (data ??
          []) as unknown as RecentUpload[];
      },
    });

  const handleDeleteDraft =
    async () => {
      if (
        !user ||
        !pendingDelete
      ) {
        return;
      }

      const draftId =
        pendingDelete.id;

      setDeletingDraftId(
        draftId,
      );

      try {
        const {
          data: draft,
          error: draftError,
        } = await supabase
          .from("resources")
          .select(
            "id, file_path",
          )
          .eq("id", draftId)
          .eq(
            "uploader_id",
            user.id,
          )
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
          } =
            await supabase.storage
              .from("resources")
              .remove([
                draft.file_path,
              ]);

          if (storageError) {
            throw storageError;
          }
        }

        const {
          data: deletedDraft,
          error: deleteError,
        } =
          await supabase
            .from("resources")
            .delete()
            .eq("id", draftId)
            .eq(
              "uploader_id",
              user.id,
            )
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

        await Promise.all([
          queryClient.invalidateQueries(
            {
              queryKey: [
                "recent-uploads",
                user.id,
              ],
            },
          ),
          queryClient.invalidateQueries(
            {
              queryKey: [
                "dash-stats",
                user.id,
              ],
            },
          ),
          queryClient.invalidateQueries(
            {
              queryKey: [
                "my-uploads",
                user.id,
              ],
            },
          ),
        ]);

        toast.success(
          "Draft deleted successfully.",
        );

        setPendingDelete(
          null,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to delete draft.",
        );
      } finally {
        setDeletingDraftId(
          null,
        );
      }
    };

  const contributor =
    getContributorLevel(
      profile?.reputation ?? 0,
    );

  const progress =
    getLevelProgress(
      profile?.reputation ?? 0,
    );

  const nextLevel =
    getNextContributorLevel(
      profile?.reputation ?? 0,
    );

  const cards = [
    {
      label: "My Uploads",
      value:
        stats?.uploads ?? 0,
      icon: Upload,
      sub: `${stats?.approved ?? 0} approved`,
    },
    {
      label: "Downloads",
      value:
        stats?.downloads ?? 0,
      icon: Download,
      sub: "All time",
    },
    {
      label: "Bookmarks",
      value:
        stats?.bookmarks ?? 0,
      icon: Bookmark,
      sub: "Saved for later",
    },
    {
      label: "Reputation",
      value:
        profile?.reputation ?? 0,
      icon: TrendingUp,
      sub: `${contributor.emoji} ${contributor.name}`,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          {isGuest
            ? "Guest"
            : roles.includes("admin")
              ? "Admin"
              : roles[0] ?? "Member"}
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Welcome back,{" "}
          {profile?.full_name?.split(
            " ",
          )[0] || "there"}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening in
          your library.
        </p>
      </div>

      <AnnouncementBanner />
      <AnnouncementPopup />

      {isGuest ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-border bg-card px-4 py-10 text-center shadow-soft sm:py-12">
          <FileCheck2 className="h-9 w-9 text-muted-foreground" />

          <h2 className="font-display text-lg font-semibold">
            Explore Aneks Library
          </h2>

          <p className="max-w-sm text-sm text-muted-foreground">
            Browse academic resources, discover learning materials, and access resources available to you.
          </p>

          <Button
            asChild
            className="group cursor-pointer bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
          >
            <Link to="/library">
              Browse Library
            <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-sm border border-border bg-card p-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant sm:p-4 lg:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                    {c.label}
                  </span>

                  <c.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
                </div>

                <div className="mt-3 font-display text-2xl font-semibold sm:mt-4 sm:text-3xl">
                  {c.value}
                </div>

                <div className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                  {c.label === "Reputation" ? (
                    <span className="text-gold">
                      {contributor.emoji} {contributor.name}
                    </span>
                  ) : (
                    c.sub
                  )}
                </div>

                {c.label ===
                  "Reputation" && (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-muted sm:mt-3 sm:h-2">
                      <div
                        className="h-full rounded-sm bg-gradient-gold transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <p className="mt-1.5 text-[9px] leading-tight text-muted-foreground sm:mt-2 sm:text-[11px]">
                      {nextLevel
                        ? `${nextLevel.pointsNeeded} pts to ${nextLevel.emoji} ${nextLevel.name}`
                        : "Highest contributor level reached 👑"}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          <div>
            {/* Section heading outside the card */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold sm:text-lg">
                  Recent uploads
                </h2>

                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Your latest uploads and their current status.
                </p>
              </div>

              <Link
                to="/my-uploads"
                className="inline-flex shrink-0 items-center text-xs font-medium text-base transition-colors hover:text-muted-foreground sm:text-sm"
              >
                View all
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Card containing only the resources */}
            <div className="overflow-hidden rounded-sm border border-border bg-card shadow-soft">
              {recent && recent.length > 0 ? (
                <ul className="divide-y divide-border">
                  {recent.map((r) => {
                    const categoryName =
                      r.category?.deleted_at == null &&
                      r.category?.name?.trim()
                        ? r.category.name.trim()
                        : "Uncategorized";

                    return (
                      <li
                        key={r.id}
                        className={`px-4 py-4 transition-colors sm:py-5 ${
                          r.status === "deleted"
                            ? "bg-muted/30"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5">
                              <StatusPill status={r.status} />
                            </div>

                            <p className="truncate text-sm font-medium sm:text-base">
                              {r.title}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                              <span>{categoryName}</span>
                              <span>·</span>
                              <span>
                                {r.download_count} downloads
                              </span>
                              <span>·</span>
                              <span>
                                {new Date(
                                  r.created_at,
                                ).toLocaleDateString()}
                              </span>
                            </div>

                            {r.status === "rejected" &&
                              r.rejection_reason && (
                                <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                                  <span className="font-medium text-foreground">
                                    Reason:
                                  </span>{" "}
                                  {r.rejection_reason}
                                </p>
                              )}
                          </div>

                          {r.status === "draft" && (
                            <div className="flex shrink-0 flex-col gap-2">
                              <Link
                                to="/upload/$draftId"
                                params={{
                                  draftId: r.id,
                                }}
                                className="inline-flex h-9 w-16 items-center justify-center rounded-sm border border-border bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                              >
                                Edit
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    id: r.id,
                                    title: r.title,
                                  })
                                }
                                disabled={deletingDraftId === r.id}
                                className="inline-flex h-9 w-16 items-center justify-center rounded-sm border border-border bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                              >
                                {deletingDraftId === r.id
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
              ) : (
                <div className="py-8">
                  <EmptyState
                    title="No uploads yet"
                    desc="Contribute your first resource. A past question, handout, lecture note, publication, etc."
                    cta={
                      <Button
                        asChild
                        variant="ghost"
                        className="group cursor-pointer bg-gradient-emerald text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground"
                      >
                        <Link to="/upload">
                          Upload
                        </Link>
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <AlertDialog
            open={
              pendingDelete !== null
            }
            onOpenChange={(open) => {
              if (
                !open &&
                !deletingDraftId
              ) {
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
                  <strong>
                    {pendingDelete?.title}
                  </strong>
                  ? This will permanently
                  remove the draft and its
                  attached file. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel
                  disabled={
                    deletingDraftId !==
                    null
                  }
                 className="inline-flex items-center justify-center rounded-sm border border-border bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                >
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    handleDeleteDraft();
                  }}
                  disabled={
                    deletingDraftId !==
                    null
                  }
                  className="bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
                >
                  {deletingDraftId !==
                    null && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                  )}

                  Delete draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    approved: "text-emerald-500",
    pending: "text-amber-500",
    rejected: "text-red-500",
    draft: "text-muted-foreground",
    archived: "text-red-500",
    deleted: "text-red-500",
  };

  const labels: Record<
    string,
    string
  > = {
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    draft: "Draft",
    archived: "Deleted",
    deleted: "Deleted",
  };

  return (
    <span
      className={`text-xs font-medium ${
        styles[status] ??
        "text-muted-foreground"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  desc,
  cta,
}: {
  title: string;
  desc: string;
  cta?: ReactNode;
}) {
  return (
    <div className="grid place-items-center p-12 text-center">
      <FileCheck2 className="h-8 w-8 text-muted-foreground" />

      <p className="mt-3 font-medium">
        {title}
      </p>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {desc}
      </p>

      {cta && (
        <div className="mt-4">
          {cta}
        </div>
      )}
    </div>
  );
}