import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  Shield,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getContributorLevel } from "@/lib/reputation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./dashboard";

export const Route = createFileRoute(
  "/_authenticated/profile/$userId",
)({
  component: PublicProfilePage,
});

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  "co-admin": "Co-admin",
  lecturer: "Lecturer",
  staff: "Staff",
  student: "Student",
  researcher: "Researcher",
  guest: "Guest",
};

const roleIcons: Record<string, typeof UserRound> = {
  admin: Shield,
  "co-admin": Shield,
  lecturer: UserRound,
  staff: UserRound,
  student: UserRound,
  researcher: UserRound,
  guest: UserRound,
};

function PublicProfilePage() {
  const { userId } = Route.useParams();

  const {
    data: profile,
    isLoading,
  } = useQuery({
    queryKey: ["public-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_public_profile", {
          _user_id: userId,
        })
        .single();

      if (error) throw error;

      return data;
    },
  });

  const {
    data: resources,
    isLoading: resourcesLoading,
    isError: resourcesError,
  } = useQuery({
    queryKey: ["public-profile-resources", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          id,
          title,
          download_count,
          created_at,
          category:categories(name, deleted_at)
        `)
        .eq("uploader_id", userId)
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return data ?? [];
    },
  });

  const totalDownloads =
    resources?.reduce(
      (sum, resource) =>
        sum + (resource.download_count ?? 0),
      0,
    ) ?? 0;

  const contributor = getContributorLevel(
    profile?.reputation ?? 0,
  );

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(
        undefined,
        {
          month: "long",
          year: "numeric",
        },
      )
    : "";

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center px-4 text-sm sm:text-base">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-[60vh] items-center justify-center px-4 text-sm sm:text-base">
        Profile not found.
      </div>
    );
  }

  const roleKey = profile.primary_role ?? "guest";
  const roleLabel =
    roleLabels[roleKey] ?? "Member";
  const RoleIcon =
    roleIcons[roleKey] ?? UserRound;

  const initials = (() => {
    const name = profile.full_name?.trim();

    if (!name) {
      return "?";
    }

    const parts = name.split(/\s+/);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  })();

  return (
    <div className="mx-auto max-w-8xl space-y-4 sm:space-y-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.history.back()}
          className="-ml-2 h-8 gap-1.5 px-2 text-xs transition-colors hover:bg-transparent hover:text-muted-foreground sm:h-9 sm:gap-2 sm:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back
        </Button>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:text-xs">
          Public Profile
        </p>

        <h1 className="mt-1 font-display text-xl font-semibold sm:text-3xl">
          {profile.full_name ?? "Unknown user"}
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Public profile and contribution history.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_340px]">
        <main className="min-w-0 space-y-4 sm:space-y-6">
          <section className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
            <div className="border-b border-border bg-muted/20 p-4 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                <div className="shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={
                        profile.full_name ??
                        "Profile"
                      }
                      className="h-28 w-24 rounded-md border-2 border-primary/30 object-cover shadow-xl sm:h-40 sm:w-32"
                    />
                  ) : (
                    <div className="flex h-28 w-24 items-center justify-center rounded-md border-2 border-primary/30 bg-muted text-3xl font-semibold shadow-lg sm:h-40 sm:w-32 sm:text-4xl">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
                      <RoleIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {roleLabel}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
                      {contributor.emoji}
                      {contributor.name}
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-xl font-semibold sm:mt-4 sm:text-3xl">
                    {profile.full_name ??
                      "Unknown user"}
                  </h2>

                  {profile.bio && (
                    <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-relaxed">
                      {profile.bio}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground sm:mt-5 sm:gap-x-5 sm:gap-y-2 sm:text-sm">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Member since{" "}
                      {joinedDate}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Public profile
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-8">
              <div className="grid grid-cols-3 text-center">
                <div className="min-w-0 px-1.5 sm:px-2">
                  <div className="text-xl font-semibold sm:text-2xl">
                    {resourcesLoading
                      ? "—"
                      : resourcesError
                        ? "—"
                        : resources?.length ?? 0}
                  </div>

                  <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
                    Resources
                  </div>
                </div>

                <div className="min-w-0 border-x px-1.5 sm:px-2">
                  <div className="text-xl font-semibold sm:text-2xl">
                    {resourcesLoading || resourcesError
                      ? "—"
                      : totalDownloads}
                  </div>

                  <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
                    Downloads
                  </div>
                </div>

                <div className="min-w-0 px-1.5 sm:px-2">
                  <div className="text-xl font-semibold sm:text-2xl">
                    {profile.reputation ?? 0}
                  </div>

                  <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
                    Reputation
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-3.5 shadow-soft sm:p-6">
            {resourcesLoading ? (
              <div className="py-7 text-center text-sm text-muted-foreground">
                Loading resources...
              </div>
            ) : resourcesError ? (
              <div className="py-7 text-center text-sm text-muted-foreground">
                Unable to load resources. Please try again.
              </div>
            ) : resources && resources.length > 0 ? (
              <ul className="divide-y divide-border border-y border-border">
                {resources.map((resource) => {
                  const categoryName =
                    resource.category?.deleted_at == null &&
                    resource.category?.name?.trim()
                      ? resource.category.name.trim()
                      : "Uncategorized";

                  return (
                    <li key={resource.id}>
                      <Link
                        to="/preview/$resourceId"
                        params={{
                          resourceId: resource.id,
                        }}
                        className="block py-3 transition-colors outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:py-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <StatusPill status="approved" />

                            <p className="mt-1.5 truncate text-sm font-medium sm:text-base">
                              {resource.title}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                              <span>{categoryName}</span>

                              <span aria-hidden="true">
                                ·
                              </span>

                              <span className="inline-flex items-center gap-1">
                                <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                {resource.download_count ?? 0}{" "}
                                downloads
                              </span>

                              <span aria-hidden="true">
                                ·
                              </span>

                              <span>
                                {new Date(
                                  resource.created_at,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="border-y border-dashed py-7 text-center sm:py-8">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground/60 sm:h-8 sm:w-8" />

                <p className="mt-2.5 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                  No approved resources yet.
                </p>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-4 sm:space-y-6">
          <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
            <div>
              <h2 className="text-sm font-semibold sm:text-base">
                Contribution
              </h2>

              <p className="text-xs text-muted-foreground sm:text-sm">
                Contributor recognition
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4 sm:mt-5 sm:pt-5">              <div className="min-w-0">
                <p className="text-sm font-semibold text-gold sm:text-base">
                  {contributor.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  Contributor level
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-4 shadow-soft sm:p-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
                <UserRound className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold sm:text-base">
                  Profile Overview
                </h2>

                <p className="text-xs text-muted-foreground sm:text-sm">
                  Public information
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4 sm:mt-5 sm:space-y-4 sm:pt-5">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Role
                </span>

                <span className="text-right text-xs font-medium sm:text-sm">
                  {roleLabel}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Member since
                </span>

                <span className="text-right text-xs font-medium sm:text-sm">
                  {joinedDate}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Resources
                </span>

                <span className="text-right text-xs font-medium sm:text-sm">
                  {resourcesLoading
                    ? "—"
                    : resourcesError
                      ? "—"
                      : resources?.length ?? 0}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Downloads
                </span>

                <span className="text-right text-xs font-medium sm:text-sm">
                  {resourcesLoading || resourcesError
                    ? "—"
                    : totalDownloads}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}