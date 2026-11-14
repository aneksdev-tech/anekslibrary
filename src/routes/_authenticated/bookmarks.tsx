import { requireRole } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccess } from "@/hooks/useAccess";
import { ResourceCard, type ResourceRow } from "./library";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/bookmarks")({
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
      { title: "Bookmarks | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Bookmarks,
});

function Bookmarks() {
  const { user } = useAuth();
  const { canDownload } = useAccess();

  const { data } = useQuery({
    queryKey: ["bookmarks-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: bookmarks, error: bookmarksError } =
        await supabase
          .from("bookmarks")
          .select("resource_id, created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false });

      if (bookmarksError) throw bookmarksError;

      const resourceIds = (bookmarks ?? []).map(
        (bookmark) => bookmark.resource_id,
      );

      if (!resourceIds.length) {
        return [] as ResourceRow[];
      }

      const { data: resources, error: resourcesError } =
        await supabase
          .from("public_resources")
          .select(
            `
              id,
              title,
              description,
              course_code,
              college,
              department,
              level,
              semester,
              year,
              tags,
              category_id,
              download_count,
              bookmark_count,
              created_at,
              file_type,
              category_name,
              category_slug
            `,
          )
          .in("id", resourceIds);

      if (resourcesError) throw resourcesError;

      const resourceMap = new Map(
        (resources ?? []).map((resource) => [
          resource.id,
          resource as unknown as ResourceRow,
        ]),
      );

      return resourceIds
        .map((resourceId) => resourceMap.get(resourceId))
        .filter(
          (resource): resource is ResourceRow =>
            Boolean(resource),
        );
    },
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          Bookmarks
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Saved for later
        </h1>
      </div>

      {data && data.length ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {data.map((r) => (
            <ResourceCard
              key={r.id}
              r={r}
              canDownload={canDownload}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-border bg-card">
          <EmptyState
            title="No bookmarks yet"
            desc="Save resources from the library to find them here."
          />
        </div>
      )}
    </div>
  );
}