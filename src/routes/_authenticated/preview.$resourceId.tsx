import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccess } from "@/hooks/useAccess";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import { getCollege } from "@/lib/academicData";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  GraduationCap,
  CalendarDays,
  School,
  Download,
  Loader2,
  ArrowLeft,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { downloadResource } from "@/lib/download";
import { getResourceScopeLabel } from "@/lib/resource-scope-labels";

export const Route = createFileRoute(
  "/_authenticated/preview/$resourceId",
)({
  component: PreviewPage,
});

function PreviewPage() {
  const { resourceId } = Route.useParams();

  const { user } = useAuth();
  const { canDownload } = useAccess();

  const queryClient = useQueryClient();

  const [upgradeOpen, setUpgradeOpen] =
    useState(false);

  const [downloadConfirmOpen, setDownloadConfirmOpen] =
    useState(false);

  const [downloading, setDownloading] =
    useState(false);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["preview", resourceId],
    enabled: !!resourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          *,
          category:categories(name, deleted_at)
        `)
        .eq("id", resourceId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const { data: uploader } = useQuery({
    queryKey: [
      "preview-uploader",
      resource?.uploader_id,
    ],
    enabled: !!resource?.uploader_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_public_profile", {
          _user_id: resource!.uploader_id,
        })
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const {
    data: previewUrl,
    isLoading: isPreviewUrlLoading,
  } = useQuery({
    queryKey: ["preview-url", resourceId],
    enabled: !!resource && !!user,
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

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm">
        Loading...
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm">
        Resource not found.
      </div>
    );
  }

  const college = getCollege(
    resource.college ?? "",
  );

  const collegeLabel = getResourceScopeLabel(
    resource.college,
    "college",
  );

  const departmentLabel = getResourceScopeLabel(
    resource.department,
    "department",
  );

  const levelLabel = getResourceScopeLabel(
    resource.level,
    "level",
  );

  const semesterLabel = getResourceScopeLabel(
    resource.semester,
    "semester",
  );

  const categoryName =
    resource.category?.deleted_at == null &&
    resource.category?.name?.trim()
      ? resource.category.name.trim()
      : "Uncategorized";

  const shareResource = async () => {
  const shareUrl = `https://anekslibrary.vercel.app/s/${resource.id}`;

    const shareData = {
      title: resource.title,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          shareData.url,
        );

        toast.success("Resource link copied!");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return;
      }

      toast.error("Unable to share resource.");
    }
  };

  const download = () => {
    if (downloading) return;

    if (!user) {
      toast.error("Sign in to download");
      return;
    }

    if (!canDownload) {
      setUpgradeOpen(true);
      return;
    }

    setDownloadConfirmOpen(true);
  };

  const confirmDownload = async () => {
    if (downloading) return;

    if (!user) {
      setDownloadConfirmOpen(false);
      toast.error("Sign in to download");
      return;
    }

    if (!canDownload) {
      setDownloadConfirmOpen(false);
      setUpgradeOpen(true);
      return;
    }

    setDownloadConfirmOpen(false);
    setDownloading(true);

    try {
      await downloadResource(resource.id);

      queryClient.invalidateQueries({
        queryKey: ["library"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Download failed.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const uploaderInitials = (() => {
    const name = uploader?.full_name?.trim();

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
    <>
      <div className="mx-3 max-w-8xl space-y-4 sm:space-y-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.history.back()}
            className="-ml-2 h-8 gap-1.5 px-2 text-xs transition-colors hover:bg-transparent hover:text-muted-foreground sm:h-9 sm:gap-2 sm:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={shareResource}
            className="h-8 gap-1.5 px-2 text-xs transition-colors hover:bg-transparent hover:text-muted-foreground sm:h-9 sm:gap-2 sm:text-sm"
            aria-label="Share resource"
          >
            <Share2 className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            Share
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 sm:mb-4">
          <span className="text-[10px] font-medium uppercase text-gold sm:text-sm">
            {categoryName}
          </span>
        </div>

        <h1 className="font-display text-xl font-semibold leading-tight sm:text-3xl">
          {resource.title}
        </h1>

        {resource.description && (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:mt-4 sm:text-sm">
            {resource.description}
          </p>
        )}

        <div className="mt-4 grid gap-2.5 text-xs sm:mt-6 sm:gap-3 sm:text-sm">
          {resource.course_code && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
              <span>{resource.course_code}</span>
            </div>
          )}

          {resource.college && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <School className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />

              <span>
                {college
                  ? `${college.name} (${college.id})`
                  : collegeLabel}
              </span>
            </div>
          )}

          {resource.department && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
              <span>{departmentLabel}</span>
            </div>
          )}

          {resource.level && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
              <span>{levelLabel}</span>
            </div>
          )}

          {resource.semester && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
              <span>{semesterLabel}</span>
            </div>
          )}

          <div className="pt-1 sm:pt-2">
            <div className="mb-2 text-xs font-medium text-muted-foreground sm:mb-3 sm:text-sm">
              Uploaded by
            </div>

            {uploader ? (
              uploader.id ? (
                <Link
                  to="/profile/$userId"
                  params={{
                    userId: uploader.id,
                  }}
                  className="group block rounded-xl pt-1 pb-1 transition-colors"
                  aria-label={`View ${
                    uploader.full_name ?? "uploader"
                  }'s public profile`}
                >
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    {uploader.avatar_url ? (
                      <img
                        src={uploader.avatar_url}
                        alt={uploader.full_name ?? "Uploader"}
                        className="h-14 w-14 shrink-0 rounded-full border object-cover sm:h-16 sm:w-16"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold sm:h-16 sm:w-16 sm:text-lg">
                        {uploaderInitials}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium sm:text-base">
                        {uploader.full_name ?? "Unknown user"}
                      </div>

                      {uploader.bio && (
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:mt-1 sm:text-sm">
                          {uploader.bio}
                        </div>
                      )}

                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-gold transition-opacity group-hover:opacity-80 sm:mt-2 sm:text-xs">
                        View profile
                        <ArrowUpRight className="h-3 w-3 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:h-3.5 sm:w-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-transparent p-2.5 sm:gap-3 sm:p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold sm:h-12 sm:w-12 sm:text-lg">
                    {uploaderInitials}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-medium sm:text-base">
                      {uploader.full_name ??
                        "Unknown user"}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2.5 rounded-sm border border-transparent p-2.5 sm:gap-3 sm:p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border bg-muted text-sm font-semibold sm:h-12 sm:w-12 sm:text-lg">
                  ?
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-medium sm:text-base">
                    Loading uploader...
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 text-xs text-muted-foreground sm:mt-4 sm:text-sm">
              Uploaded on{" "}
              {new Date(
                resource.created_at,
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>

          <div className="mb-4 max-w-sm pt-1 lg:mb-5 sm:pt-2">
  <Button
    type="button"
    variant="ghost"
    className="h-9 w-full bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:w-52 sm:text-sm"
    onClick={download}
    disabled={downloading}
  >
    {downloading ? (
      <>
        <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
        Downloading...
      </>
    ) : (
      <>
        <Download className="mr-1.5 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4" />
        Download
      </>
    )}
  </Button>
</div>
        </div>
      </div>

      <div className="rounded-sm border bg-card p-2.5 sm:p-4">
        {previewUrl ? (
          <DocumentPreview
            url={previewUrl.url}
            token={previewUrl.accessToken}
            resourceId={resource.id}
            context="public"
            filePath={resource.file_path}
            title={resource.title}
            onUpgradeClick={() => setUpgradeOpen(true)}
          />
        ) : isPreviewUrlLoading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm sm:h-[70vh]">
            Preparing preview...
          </div>
        ) : (
          <div className="flex h-[60vh] items-center justify-center text-xs text-muted-foreground sm:h-[70vh] sm:text-sm">
            Preview unavailable.
          </div>
        )}
      </div>

      <AlertDialog
        open={downloadConfirmOpen}
        onOpenChange={(open) => {
          if (!downloading) {
            setDownloadConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Confirm Download
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Are you sure you want to download{" "}
              <strong className="text-foreground">
                {resource.title}
              </strong>
              ?

              <br />
              <br />

              The resource will be downloaded to your device.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={downloading}
              className="h-9 bg-destructive text-white text-xs sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDownload();
              }}
              disabled={downloading}
              className="pr-5.5 h-9 bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
      />
    </>
  );
}