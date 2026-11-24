import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CheckCheck,
  Loader2,
} from "lucide-react";
import { EmptyState } from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/notifications",
)({
  head: () => ({
    meta: [
      { title: "Notifications | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: [
      "notifications",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const unreadCount =
    data?.filter(
      (n) => !n.read,
    ).length ?? 0;

  const markRead = useMutation({
    mutationFn: async (
      notificationId: string,
    ) => {
      const {
        error,
      } = await supabase
        .from("notifications")
        .update({
          read: true,
        })
        .eq("id", notificationId)
        .eq("user_id", user!.id);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [
          "notifications",
          user?.id,
        ],
      });

      qc.invalidateQueries({
        queryKey: [
          "notif-count",
          user?.id,
        ],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const {
        error,
      } = await supabase
        .from("notifications")
        .update({
          read: true,
        })
        .eq("user_id", user!.id)
        .eq("read", false);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      toast.success(
        "All notifications marked as read.",
      );

      qc.invalidateQueries({
        queryKey: [
          "notifications",
          user?.id,
        ],
      });

      qc.invalidateQueries({
        queryKey: [
          "notif-count",
          user?.id,
        ],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            Notifications
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-display text-lg font-semibold sm:text-3xl">
              What's new for you
            </h1>

            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold text-gold sm:px-2.5 sm:py-1 sm:text-xs">
                {unreadCount} unread
              </span>
            )}
          </div>

          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
            Updates about your uploads, account, and activity.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="group mb-0.5 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm bg-gradient-emerald px-2.5 py-1.5 text-[10px] font-medium text-white shadow-soft hover:bg-none hover:bg-accent hover:text-foreground sm:mb-1 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
            disabled={
              markAll.isPending
            }
            onClick={() =>
              markAll.mutate()
            }
          >
            <CheckCheck className="h-3.5 w-3.5 transition-colors group-hover:text-foreground sm:h-4 sm:w-4" />

            {markAll.isPending
              ? "Marking…"
              : "Read all"}
          </button>
        )}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="p-3 sm:p-4">
  <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
            Loading notifications…
          </div>
        </div>
      ) : data && data.length ? (
        <div className="divide-y divide-border border-y border-border">
          {data.map((n) => {
          const isRejected =
  n.title === "Resource rejected" ||
  n.title === "Upload rejected";

const isApproved =
  n.title === "Resource approved" ||
  n.title === "Upload approved";

const isDeleted =
  n.title === "Resource deleted" ||
  n.title === "Upload deleted";

const statusLabel = isApproved
  ? "Approved"
  : isRejected
    ? "Rejected"
    : isDeleted
      ? "Deleted"
      : n.title;

const statusColor = isApproved
  ? "text-emerald-500"
  : isRejected || isDeleted
    ? "text-red-500"
    : "text-foreground";


            const body =
              n.body ?? "";
let mainMessage = body;
let notificationReason: string | null = null;

if (isRejected || isDeleted) {
  const reasonMarker = " Reason: ";
  const reasonIndex = body.indexOf(reasonMarker);

  if (reasonIndex !== -1) {
    mainMessage = body.slice(0, reasonIndex);

    notificationReason = body
      .slice(reasonIndex + reasonMarker.length)
      .trim();
  }
}

            if (isApproved) {
              mainMessage = body.replace(
                /\.\s*$/,
                " and added to the library.",
              );
            }

            return (
              <div
                key={n.id}
              >
                <div className="group py-4 sm:py-5">
                  <div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-2">
<p
  className={`min-w-0 flex-1 text-xs font-medium leading-snug ${
    !n.read ? "font-semibold" : ""
  } ${statusColor}`}
>
  {statusLabel}
</p>
{!n.read && (
  <span className="shrink-0 animate-pulse text-[10px] font-semibold uppercase tracking-wide text-gold sm:text-xs">
  New
</span>
)}
                      </div>

                      {mainMessage && (
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                          {mainMessage}
                        </p>
                      )}
{(isRejected || isDeleted) &&
  notificationReason && (
    <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
      <span className="font-medium text-foreground">
        Reason:
      </span>{" "}
      {notificationReason}
    </p>
  )}
                        <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-2">
                        <p className="min-w-0 text-[10px] text-muted-foreground sm:text-xs">
                          {new Date(
                            n.created_at,
                          ).toLocaleString()}
                        </p>

                        {!n.read && (
                          <button
                            type="button"
                            className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-xs"
                            disabled={
                              markRead.isPending
                            }
                            onClick={() =>
                              markRead.mutate(
                                n.id,
                              )
                            }
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="You're all caught up"
          desc="Notifications about your uploads and account will appear here."
        />
      )}
    </div>
  );
}
