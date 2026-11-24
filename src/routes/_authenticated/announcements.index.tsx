import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCheck,
  Loader2,
  Megaphone,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute(
  "/_authenticated/announcements/",
)({
  head: () => ({
    meta: [
      { title: "Announcements | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Announcements,
});

function Announcements() {
  const queryClient = useQueryClient();

  const {
    data: {
      user,
    } = {},
  } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return {
    user: data.session?.user ?? null,
  };
},
  });

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "announcements",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        data: announcements,
        error: announcementsError,
      } = await supabase
        .from("announcements")    
        .select(
          "id, title, body, content, link, is_active, published_at, updated_at",
        )
        .is("deleted_at", null)
        .not("published_at", "is", null)
        .order("is_active", {
          ascending: false,
        })
        .order("published_at", {
          ascending: false,
        });

      if (announcementsError) {
        throw announcementsError;
      }

      if (!announcements?.length) {
        return [];
      }

      const announcementIds =
        announcements.map(
          (announcement) =>
            announcement.id,
        );

      const {
        data: reads,
        error: readsError,
      } = await supabase
        .from("announcement_reads")
        .select(
          "announcement_id, read_at",
        )
        .eq("user_id", user!.id)
        .in(
          "announcement_id",
          announcementIds,
        );

      if (readsError) {
        throw readsError;
      }

      const readIds = new Set(
        (reads ?? []).map(
          (read) =>
            read.announcement_id,
        ),
      );

      return announcements.map(
        (announcement) => ({
          ...announcement,
          is_read: readIds.has(
            announcement.id,
          ),
        }),
      );
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (
      announcementId: string,
    ) => {
      if (!user) {
        throw new Error(
          "You must be signed in.",
        );
      }

      const {
        error,
      } = await supabase.rpc(
        "mark_announcement_as_read",
        {
          _announcement_id:
            announcementId,
        },
      );

      if (error) {
        throw error;
      }
    },

    onMutate: async (
      announcementId,
    ) => {
      await queryClient.cancelQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });

      const previousAnnouncements =
        queryClient.getQueryData(
          [
            "announcements",
            user?.id,
          ],
        );

      queryClient.setQueryData(
        [
          "announcements",
          user?.id,
        ],
        (
          current:
            | typeof data
            | undefined,
        ) =>
          current?.map(
            (announcement) =>
              announcement.id ===
              announcementId
                ? {
                    ...announcement,
                    is_read: true,
                  }
                : announcement,
          ),
      );

      return {
        previousAnnouncements,
      };
    },

    onError: (
      _error,
      _announcementId,
      context,
    ) => {
      if (
        context?.previousAnnouncements
      ) {
        queryClient.setQueryData(
          [
            "announcements",
            user?.id,
          ],
          context.previousAnnouncements,
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcement-count",
          user?.id,
        ],
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(
          "You must be signed in.",
        );
      }

      const unreadAnnouncements =
        data?.filter(
          (announcement) =>
            !announcement.is_read,
        ) ?? [];

      if (
        !unreadAnnouncements.length
      ) {
        return;
      }

      for (const announcement of
        unreadAnnouncements) {
        const {
          error,
        } = await supabase.rpc(
          "mark_announcement_as_read",
          {
            _announcement_id:
              announcement.id,
          },
        );

        if (error) {
          throw error;
        }
      }
    },

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });

      const previousAnnouncements =
        queryClient.getQueryData(
          [
            "announcements",
            user?.id,
          ],
        );

      queryClient.setQueryData(
        [
          "announcements",
          user?.id,
        ],
        (
          current:
            | typeof data
            | undefined,
        ) =>
          current?.map(
            (announcement) => ({
              ...announcement,
              is_read: true,
            }),
          ),
      );

      return {
        previousAnnouncements,
      };
    },

    onError: (
      _error,
      _variables,
      context,
    ) => {
      if (
        context?.previousAnnouncements
      ) {
        queryClient.setQueryData(
          [
            "announcements",
            user?.id,
          ],
          context.previousAnnouncements,
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcement-count",
          user?.id,
        ],
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });
    },
  });

  const unreadCount =
  data?.filter(
    (announcement) =>
      !announcement.is_read,
  ).length ?? 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            Announcements
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
  <h1 className="font-display text-lg font-semibold sm:text-3xl">
    Stay up to date
  </h1>

  {unreadCount > 0 && (
    <span className="text-[10px] font-semibold text-gold sm:px-2.5 sm:py-1 sm:text-xs">
      {unreadCount} unread
    </span>
  )}
</div>

          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
            Important updates and news from Aneks Library.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="group mb-0.5 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm bg-gradient-emerald px-2.5 py-1.5 text-[10px] font-medium text-white shadow-soft hover:bg-none hover:bg-accent hover:text-foreground sm:mb-1 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
            disabled={
              markAllAsRead.isPending
            }
            onClick={() =>
              markAllAsRead.mutate()
            }
          >
            <CheckCheck className="h-3.5 w-3.5 transition-colors group-hover:text-foreground sm:h-4 sm:w-4" />

            {markAllAsRead.isPending
              ? "Marking…"
              : "Read all"}
          </button>
        )}
      </div>

      {/* Announcement list */}
      {isLoading ? (
        <div className="p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
            Loading announcements…
          </div>
        </div>
      ) : error ? (
        <div className="grid min-h-[30vh] place-items-center px-3 sm:px-0">
          <div className="max-w-md text-center">
            <Megaphone className="mx-auto h-6 w-6 text-muted-foreground sm:h-8 sm:w-8" />

            <h2 className="mt-3 font-display text-base font-semibold sm:mt-4 sm:text-xl">
              Unable to load announcements
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
              Something went wrong while loading announcements.
              Please try again later.
            </p>
          </div>
        </div>
      ) : data && data.length ? (
        <div className="divide-y divide-border border-y border-border">
          {data.map((announcement) => {
            const preview =
              announcement.content?.trim() ||
              announcement.body;

            const truncatedPreview =
              preview.length > 180
                ? `${preview
                    .slice(0, 180)
                    .trimEnd()}…`
                : preview;

            return (
              <article
                key={announcement.id}
                 className="group py-4 sm:py-5">
                  <div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
                    <div className="min-w-0 flex-1">
                {announcement.is_active && (
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gold sm:mb-2.5 sm:text-xs">
                    ACTIVE
                  </div>
                )}

                <Link
                  to="/announcements/$announcementId"
                  params={{
                    announcementId:
                      announcement.id,
                  }}
                  className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  onClick={() => {
                    if (
                      !announcement.is_read
                    ) {
                      markAsRead.mutate(
                        announcement.id,
                      );
                    }
                  }}
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h2 className="min-w-0 flex-1 font-display text-[13px] font-semibold leading-snug sm:text-lg">
                      {announcement.title}
                    </h2>

                    {!announcement.is_read && (
                      <span className="shrink-0 animate-pulse text-[10px] font-semibold uppercase tracking-wide text-gold sm:text-xs">
                        New
                      </span>
                    )}
                  </div>

                  {truncatedPreview && (
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                      {truncatedPreview}
                    </p>
                  )}
                </Link>

                
          {announcement.published_at && (

  <div className="mt-1.5 flex min-w-0 items-start justify-between gap-2 sm:mt-2">
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
      <p className="min-w-0 text-[10px] leading-4 text-muted-foreground sm:text-xs">
        Published{" "}
        {new Date(
          announcement.published_at,
        ).toLocaleString()}
      </p>  {announcement.updated_at &&
    new Date(announcement.updated_at).getTime() >
      new Date(announcement.published_at).getTime() && (
      <p className="min-w-0 text-[10px] leading-4 text-muted-foreground sm:text-xs">
        Updated{" "}
        {new Date(
          announcement.updated_at,
        ).toLocaleString()}
      </p>
    )}
</div>

<Link
  to="/announcements/$announcementId"
  params={{
    announcementId: announcement.id,
  }}
  className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm"
  onClick={() => {
    if (!announcement.is_read) {
      markAsRead.mutate(announcement.id);
    }
  }}
>
  View &gt;
</Link>

  </div>
)}
</div>
</div>
            </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No announcements yet"
          desc="Announcements and important updates will appear here."
        />
      )}
    </div>
  );
}
