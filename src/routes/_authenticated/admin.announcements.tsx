import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Power, PowerOff, Loader2, History, ChevronDown, ChevronUp, Filter, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute(
  "/_authenticated/admin/announcements",
)({
  head: () => ({
    meta: [
      { title: "Announcements | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnnouncementsPage,
});

type AnnouncementProfile = {
  full_name: string | null;
  email: string | null;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  content: string | null;
  link: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deletion_reason: string | null;
  creator?: AnnouncementProfile | null;
  updater?: AnnouncementProfile | null;
  deleter?: AnnouncementProfile | null;
};

type AnnouncementAudit = {
  id: string;
  announcement_id: string;
  performed_by: string;
  action: string;
  reason: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
  performer?: AnnouncementProfile | null;
};

type PendingToggle = {
  announcement: Announcement;
  nextIsActive: boolean;
};

function AnnouncementsPage() {
  const { user, roles } = useAuth();

  const isAdminOrCoAdmin =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

  const isStaff = roles?.includes("staff");

  const canPublishAnnouncements = isAdminOrCoAdmin;

  const canManageAnnouncement = (
    announcement: Announcement,
  ) =>
    Boolean(
      isAdminOrCoAdmin ||
        (isStaff &&
          announcement.created_by === user?.id),
    );

  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");

  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);

  const announcementFormRef = useRef<HTMLDivElement>(null);

  const [editSummary, setEditSummary] = useState("");
  const [pendingEditSave, setPendingEditSave] =
    useState<boolean>(false);

  const [pendingToggle, setPendingToggle] =
    useState<PendingToggle | null>(null);

  const [toggleReason, setToggleReason] = useState("");
  const toggleReasonRef =
    useRef<HTMLTextAreaElement | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Announcement | null>(null);

  const [deleteReason, setDeleteReason] = useState("");

  const [expandedHistoryIds, setExpandedHistoryIds] =
    useState<Set<string>>(new Set());
  
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [announcementSearch, setAnnouncementSearch] =
  useState("");

  const [sortOrder, setSortOrder] = useState<
    "newest" | "oldest"
  >("newest");

const [pendingRepublish, setPendingRepublish] =
  useState<Announcement | null>(null);

const [republishReason, setRepublishReason] =
  useState("");

  const { data: announcements, isLoading } = useQuery({
  queryKey: ["admin-announcements"],
  staleTime: 60_000,
    queryFn: async (): Promise<Announcement[]> => {
      const { data: announcements, error } = await supabase
        .from("announcements")
        .select(
          "id, title, body, content, link, is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at, deletion_reason",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!announcements?.length) {
        return [];
      }

      const profileIds = [
        ...new Set(
          announcements
            .flatMap((announcement) => [
              announcement.created_by,
              announcement.updated_by,
              announcement.deleted_by,
            ])
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      if (!profileIds.length) {
        return announcements;
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<
        string,
        AnnouncementProfile
      >(
        (profiles ?? [])
          .filter(
            (
              profile,
            ): profile is typeof profile & {
              id: string;
            } => profile.id !== null,
          )
          .map((profile) => [
            profile.id,
            {
              full_name: profile.full_name,
              email: profile.email,
            },
          ]),
      );

      return announcements.map(
        (announcement): Announcement => ({
          ...announcement,
          creator: announcement.created_by
            ? profileMap.get(
                announcement.created_by,
              ) ?? null
            : null,
          updater: announcement.updated_by
            ? profileMap.get(
                announcement.updated_by,
              ) ?? null
            : null,
          deleter: announcement.deleted_by
            ? profileMap.get(
                announcement.deleted_by,
              ) ?? null
            : null,
        }),
      );
    },
  });

  const {
  data: auditLogs = [],
  isLoading: isAuditLoading,
} = useQuery({
  queryKey: ["admin-announcement-audits"],
  enabled: expandedHistoryIds.size > 0,
  staleTime: 60_000,
    queryFn: async (): Promise<AnnouncementAudit[]> => {
      const { data: audits, error } = await supabase
        .from("announcement_audit_logs")
        .select(
          "id, announcement_id, performed_by, action, reason, old_data, new_data, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!audits?.length) {
        return [];
      }

      const performerIds = [
        ...new Set(
          audits
            .map((audit) => audit.performed_by)
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      if (!performerIds.length) {
        return audits;
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name, email")
        .in("id", performerIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<
        string,
        AnnouncementProfile
      >(
        (profiles ?? [])
          .filter(
            (
              profile,
            ): profile is typeof profile & {
              id: string;
            } => profile.id !== null,
          )
          .map((profile) => [
            profile.id,
            {
              full_name: profile.full_name,
              email: profile.email,
            },
          ]),
      );

      return audits.map(
        (audit): AnnouncementAudit => ({
          ...audit,
          performer:
            profileMap.get(audit.performed_by) ??
            null,
        }),
      );
    },
  });

  const getAnnouncementHistory = (
    announcementId: string,
  ) =>
    auditLogs.filter(
      (audit) =>
        audit.announcement_id === announcementId,
    );

  const getLatestAudit = (
    announcementId: string,
  ) => {
    const history = getAnnouncementHistory(
      announcementId,
    );

    return history[0] ?? null;
  };

  
const activeAndInactiveAnnouncements = (
  announcements ?? []
)
  .filter((announcement) => !announcement.deleted_at)
  .filter((announcement) => {
    const searchTerm = announcementSearch
      .trim()
      .toLowerCase();

    const matchesSearch =
      announcement.title.toLowerCase().includes(searchTerm) ||
      announcement.body.toLowerCase().includes(searchTerm);

    if (!matchesSearch) {
      return false;
    }

    if (statusFilter === "active") {
      return announcement.is_active;
    }

    if (statusFilter === "inactive") {
      return !announcement.is_active;
    }

    return true;
  })
  .sort((a, b) => {
    // Active announcements always appear first.
    const statusDifference =
      Number(b.is_active) - Number(a.is_active);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    return sortOrder === "newest"
      ? dateB - dateA
      : dateA - dateB;
  });


const deletedAnnouncements = (announcements ?? [])
  .filter((announcement) => Boolean(announcement.deleted_at))
  .sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    return sortOrder === "newest"
      ? dateB - dateA
      : dateA - dateB;
  });

const clearAnnouncementFilters = () => {
  setAnnouncementSearch("");
  setStatusFilter("all");
  setSortOrder("newest");
};
  const toggleHistory = (announcementId: string) => {
    setExpandedHistoryIds((current) => {
      const next = new Set(current);

      if (next.has(announcementId)) {
        next.delete(announcementId);
      } else {
        next.add(announcementId);
      }

      return next;
    });
  };

  const saveAnnouncement = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      const trimmedTitle = title.trim();
      const trimmedBody = body.trim();
      const trimmedContent = content.trim();
      const trimmedLink = link.trim() || null;

      if (!trimmedTitle) {
        throw new Error(
          "Announcement title is required.",
        );
      }

      if (!trimmedBody) {
        throw new Error(
          "Announcement message is required.",
        );
      }

      if (!trimmedContent) {
        throw new Error(
          "Announcement content is required.",
        );
      }

      if (editingAnnouncement) {
        const { data, error } = await supabase.rpc(
          "admin_edit_announcement",
          {
            _announcement_id:
              editingAnnouncement.id,
            _title: trimmedTitle,
            _body: trimmedBody,
            _content: trimmedContent,
            _link: trimmedLink || undefined,
            _edit_summary:
              editSummary.trim() || undefined,
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
            "The announcement could not be updated.",
          );
        }

        return result.changed
          ? "updated"
          : "unchanged";
      }

      const { data, error } = await supabase.rpc(
        "admin_create_announcement",
        {
          _title: trimmedTitle,
          _body: trimmedBody,
          _content: trimmedContent,
          _link: trimmedLink || undefined,
        },
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The announcement could not be published.",
        );
      }

      return "created";
    },

    onSuccess: (result) => {
      if (result === "unchanged") {
        toast.info("No changes were made.");
      } else {
        toast.success(
          result === "created"
            ? "Announcement published successfully."
            : "Announcement updated successfully.",
        );
      }

      setTitle("");
      setBody("");
      setContent("");
      setLink("");
      setEditSummary("");
      setEditingAnnouncement(null);
      setPendingEditSave(false);

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleAnnouncement = useMutation({
    mutationFn: async ({
      announcement,
      reason,
    }: {
      announcement: Announcement;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      if (announcement.deleted_at) {
        throw new Error(
          "Deleted announcements cannot be activated or deactivated.",
        );
      }

      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        throw new Error(
          announcement.is_active
            ? "A deactivation reason is required."
            : "An activation reason is required.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_toggle_announcement",
        {
          _announcement_id: announcement.id,
          _is_active: !announcement.is_active,
          _reason: trimmedReason,
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
          "The announcement status could not be updated.",
        );
      }

      return result.changed ?? false;
    },

    onSuccess: (changed, variables) => {
      toast.success(
        changed
          ? variables.announcement.is_active
            ? "Announcement deactivated successfully."
            : "Announcement activated successfully."
          : "No changes were made.",
      );

      setPendingToggle(null);
      setToggleReason("");

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async ({
      announcement,
      reason,
    }: {
      announcement: Announcement;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      if (announcement.deleted_at) {
        throw new Error(
          "This announcement has already been deleted.",
        );
      }

      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_delete_announcement",
        {
          _announcement_id: announcement.id,
          _deletion_reason: trimmedReason,
        },
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The announcement could not be deleted.",
        );
      }
    },

    onSuccess: () => {
      toast.success("Announcement deleted.");

      setPendingDelete(null);
      setDeleteReason("");

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const republishAnnouncement = useMutation({
  mutationFn: async ({
    announcement,
    reason,
  }: {
    announcement: Announcement;
    reason: string;
  }) => {
    if (!user) {
      throw new Error(
        "You must be signed in to republish announcements.",
      );
    }

    if (!isAdminOrCoAdmin) {
      throw new Error(
        "Only Admin or Co-admin can republish announcements.",
      );
    }

    if (announcement.deleted_at) {
      throw new Error(
        "Deleted announcements cannot be republished.",
      );
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      throw new Error("A republish reason is required.");
    }

    const { data, error } = await supabase.rpc(
      "admin_republish_announcement",
      {
        _announcement_id: announcement.id,
        _reason: trimmedReason,
      },
    );

    if (error) {
      throw error;
    }

    const result = data as {
      id?: string;
      changed?: boolean;
      read_records_reset?: number;
    } | null;

    if (!result?.id) {
      throw new Error(
        "The announcement could not be republished.",
      );
    }

    return result;
  },

  onSuccess: (result) => {
    toast.success(
      `Announcement republished successfully. ${
        result.read_records_reset ?? 0
      } previous read record(s) reset.`,
    );

    setPendingRepublish(null);
    setRepublishReason("");

    qc.invalidateQueries({
      queryKey: ["admin-announcements"],
    });

    qc.invalidateQueries({
      queryKey: ["active-announcement"],
    });

    qc.invalidateQueries({
      queryKey: ["admin-announcement-audits"],
    });
  },

  onError: (error: Error) => {
    toast.error(error.message);
  },
});

  const startEditing = (
  announcement: Announcement,
) => {
  if (announcement.deleted_at) {
    return;
  }

  setEditingAnnouncement(announcement);
  setTitle(announcement.title);
  setBody(announcement.body);
  setContent(announcement.content ?? "");
  setLink(announcement.link ?? "");
  setEditSummary("");
  setPendingEditSave(false);

  announcementFormRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

  const cancelEditing = () => {
    if (saveAnnouncement.isPending) {
      return;
    }

    setEditingAnnouncement(null);
    setTitle("");
    setBody("");
    setContent("");
    setLink("");
    setEditSummary("");
    setPendingEditSave(false);
  };

  const hasActualChanges = () => {
    if (!editingAnnouncement) {
      return true;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedContent = content.trim();
    const trimmedLink = link.trim() || null;

    return (
      trimmedTitle !== editingAnnouncement.title ||
      trimmedBody !== editingAnnouncement.body ||
      trimmedContent !==
        (editingAnnouncement.content ?? "") ||
      trimmedLink !== editingAnnouncement.link
    );
  };

  const handleSave = () => {
    if (!editingAnnouncement) {
      saveAnnouncement.mutate();
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      toast.error("Announcement title is required.");
      return;
    }

    if (!trimmedBody) {
      toast.error(
        "Announcement message is required.",
      );
      return;
    }

    if (!trimmedContent) {
      toast.error(
        "Announcement content is required.",
      );
      return;
    }

    setPendingEditSave(true);
  };

  const closeEditConfirmation = () => {
    if (saveAnnouncement.isPending) {
      return;
    }

    setPendingEditSave(false);
  };

  const confirmEditSave = () => {
    if (!editingAnnouncement) {
      return;
    }

    if (!hasActualChanges()) {
      setPendingEditSave(false);
      toast.info("No changes were made.");
      return;
    }

    if (!editSummary.trim()) {
      toast.error("An edit summary is required.");
      return;
    }

    saveAnnouncement.mutate();
  };

  const openToggleDialog = (
    announcement: Announcement,
  ) => {
    if (announcement.deleted_at) {
      return;
    }

    setPendingToggle({
      announcement,
      nextIsActive: !announcement.is_active,
    });

    setToggleReason("");
  };

  const closeToggleDialog = () => {
    if (toggleAnnouncement.isPending) {
      return;
    }

    setPendingToggle(null);
    setToggleReason("");
  };

  const handleToggle = () => {
    if (!pendingToggle) {
      return;
    }

    const reason =
      toggleReasonRef.current?.value.trim() ??
      toggleReason.trim();

    if (!reason) {
      toast.error(
        pendingToggle.nextIsActive
          ? "Please provide an activation reason."
          : "Please provide a deactivation reason.",
      );
      return;
    }

    toggleAnnouncement.mutate({
      announcement: pendingToggle.announcement,
      reason,
    });
  };

  const openDeleteDialog = (
    announcement: Announcement,
  ) => {
    setPendingDelete(announcement);
    setDeleteReason("");
  };

  const openRepublishDialog = (
  announcement: Announcement,
) => {
  if (!isAdminOrCoAdmin || announcement.deleted_at) {
    return;
  }

  setPendingRepublish(announcement);
  setRepublishReason("");
};


  const closeRepublishDialog = () => {
    if (republishAnnouncement.isPending) {
      return;
    }

    setPendingRepublish(null);
    setRepublishReason("");
  };

  const handleRepublish = () => {
    if (!pendingRepublish) {
      return;
    }

    const trimmedReason = republishReason.trim();

    if (!trimmedReason) {
      toast.error(
        "Please provide a reason for republishing this announcement.",
      );
      return;
    }

    republishAnnouncement.mutate({
      announcement: pendingRepublish,
      reason: trimmedReason,
    });
  };


  const closeDeleteDialog = () => {
    if (deleteAnnouncement.isPending) {
      return;
    }

    setPendingDelete(null);
    setDeleteReason("");
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const trimmedReason = deleteReason.trim();

    if (!trimmedReason) {
      toast.error(
        "Please provide a reason for deleting this announcement.",
      );
      return;
    }

    deleteAnnouncement.mutate({
      announcement: pendingDelete,
      reason: trimmedReason,
    });
  };

  const getAuditActionLabel = (action: string) => {
    switch (action) {
      case "create":
        return "Created";
      case "edit":
        return "Edited";
      case "activate":
        return "Activated";
      case "deactivate":
        return "Deactivated";
      case "delete":
        return "Deleted";
      case "republish":
        return "Republished";
      default:
        return action;
    }
  };

  return (
    <section className="space-y-5 sm:space-y-6">
      {/* Announcement form */}
      <div
        ref={announcementFormRef}
        className="scroll-mt-4 rounded-sm border border-border bg-card p-3.5 sm:rounded-sm sm:p-5"
      >
        <div className="mb-4 flex items-start gap-2 sm:mb-5 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold sm:text-sm">
              {editingAnnouncement
                ? "Edit announcement"
                : "Create announcement"}
            </p>

            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              {canPublishAnnouncements
                ? "Publish important information to the Dashboard announcement banner."
                : "Create an announcement for Admin or Co-admin review and publication."}
            </p>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-title"
              className="text-xs font-medium sm:text-sm"
            >
              Title
            </label>

            <Input
              id="announcement-title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. New Upload Guidelines"
              disabled={saveAnnouncement.isPending}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-body"
              className="text-xs font-medium sm:text-sm"
            >
              Message / Summary
            </label>

            <textarea
              id="announcement-body"
              value={body}
              onChange={(event) =>
                setBody(event.target.value)
              }
              placeholder="Enter a short summary for the Dashboard announcement banner..."
              rows={4}
              disabled={saveAnnouncement.isPending}
              className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-content"
              className="text-xs font-medium sm:text-sm"
            >
              Full Content
            </label>

            <textarea
              id="announcement-content"
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder="Enter the complete announcement details..."
              rows={10}
              disabled={saveAnnouncement.isPending}
              className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              This is the full content users will see when they open the announcement.
            </p>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-link"
              className="text-xs font-medium sm:text-sm"
            >
              Link
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </label>

            <Input
              id="announcement-link"
              value={link}
              onChange={(event) =>
                setLink(event.target.value)
              }
              placeholder="e.g. /library"
              disabled={saveAnnouncement.isPending}
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
  type="button"
  variant="ghost"
  onClick={handleSave}
  disabled={saveAnnouncement.isPending}
  className="h-9 w-full bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:w-auto sm:text-sm"
>
  {saveAnnouncement.isPending && (
  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
)}
  {saveAnnouncement.isPending
    ? editingAnnouncement
      ? "Saving…"
      : canPublishAnnouncements
        ? "Publishing…"
        : "Submitting…"
    : editingAnnouncement
      ? "Save changes"
      : canPublishAnnouncements
        ? "Publish announcement"
        : "Submit announcement"}
</Button>
            {editingAnnouncement && (
              <Button
                type="button"
                variant="outline"
                onClick={cancelEditing}
                disabled={saveAnnouncement.isPending}
                className="h-9 bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Announcement history */}
      <div className="overflow-hidden rounded-sm border border-border bg-card sm:rounded-sm">
        <div className="border-border p-3.5 sm:p-5">
          <h2 className="font-display text-base font-semibold sm:text-lg">
            Announcements
          </h2>

          <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
            Manage published and inactive announcements.
          </p>
        </div>

<div className="mx-3 mb-3 rounded-sm border border-border bg-card p-3 sm:mx-5 sm:p-4">
  <div className="mb-3 flex items-center gap-2">
    <Filter className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />

    <h3 className="text-[10px] font-semibold text-muted-foreground sm:text-xs">
      Find announcements
    </h3>
  </div>

  <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
    {/* Search */}
    <div className="relative sm:col-span-2">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

      <Input
        placeholder="Search announcement title or message…"
        value={announcementSearch}
        onChange={(e) => setAnnouncementSearch(e.target.value)}
        className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
      />
    </div>

    {/* Status */}
    <Select
      value={statusFilter}
      onValueChange={(value) =>
        setStatusFilter(
          value as "all" | "active" | "inactive",
        )
      }
    >
      <SelectTrigger
        id="announcement-status-filter"
        className="h-9 text-xs sm:h-10 sm:text-sm"
      >
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>

    {/* Date order */}
    <Select
      value={sortOrder}
      onValueChange={(value) =>
        setSortOrder(value as "newest" | "oldest")
      }
    >
      <SelectTrigger
        id="announcement-sort-order"
        className="h-9 text-xs sm:h-10 sm:text-sm"
      >
        <SelectValue placeholder="Newest first" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="newest">Newest first</SelectItem>
        <SelectItem value="oldest">Oldest first</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <p className="pl-1 text-[10px] text-gold sm:text-xs">
      Showing {activeAndInactiveAnnouncements.length}{" "}
      {activeAndInactiveAnnouncements.length === 1
        ? "announcement"
        : "announcements"}
    </p>

    {(announcementSearch.trim() !== "" ||
      statusFilter !== "all" ||
      sortOrder !== "newest") && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={clearAnnouncementFilters}
        className="h-7 px-2 text-xs text-gold sm:h-8"
      >
        <X className="h-3.5 w-3.5" />
        Clear filters
      </Button>
    )}
  </div>
</div>


        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
              Loading announcements…
            </div>
          </div>
        ) : activeAndInactiveAnnouncements.length > 0 ? (
          <ul className="divide-y divide-border">
            {activeAndInactiveAnnouncements.map((announcement) => {
              const isToggling =
                toggleAnnouncement.isPending &&
                toggleAnnouncement.variables?.announcement
                  .id === announcement.id;

              const isDeleting =
                deleteAnnouncement.isPending &&
                deleteAnnouncement.variables?.announcement
                  .id === announcement.id;

              const isDeleted =
                announcement.deleted_at !== null;

              const history =
                getAnnouncementHistory(announcement.id);

              const latestAudit =
                getLatestAudit(announcement.id);

              const isHistoryExpanded =
                expandedHistoryIds.has(
                  announcement.id,
                );

              return (
                <li
                  key={announcement.id}
                  className={`p-3.5 transition-colors sm:p-5 ${
                    isDeleted
                      ? "bg-muted/40"
                      : announcement.is_active
                        ? "bg-card/[0.03]"
                        : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col gap-4 border-t pt-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wide sm:text-[10px] ${
                            isDeleted
                              ? "text-destructive"
                              : announcement.is_active
                                ? "text-gold"
                                : "text-muted-foreground"
                          }`}
                        >
                          {isDeleted
                            ? "Deleted"
                            : announcement.is_active
                              ? "Active"
                              : "Inactive"}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-sm font-medium sm:mt-2 sm:text-base">
                        {announcement.title}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                        {announcement.body}
                      </p>

                      {announcement.link && (
                        <p className="mt-1.5 break-all text-[10px] text-primary sm:mt-2 sm:text-xs">
                          Link: {announcement.link}
                        </p>
                      )}

                      <div className="mt-2.5 space-y-1 text-[10px] leading-4 text-muted-foreground sm:mt-3 sm:text-xs sm:leading-normal">
  <p>
    <span className="font-medium text-foreground">Created:</span>{" "}
    {new Date(announcement.created_at).toLocaleString()}
  </p>

  <p>
    <span className="font-medium text-foreground">By:</span>{" "}
    {announcement.creator?.full_name ?? "Unknown user"}
  </p>

  <p>
    <span className="font-medium text-foreground">Email:</span>{" "}
    {announcement.creator?.email ?? "Unavailable"}
  </p>

  {!isDeleted && latestAudit && latestAudit.action !== "create" && (
    <>
      <p className="pt-1">
        <span className="font-medium text-foreground">
          {getAuditActionLabel(latestAudit.action)}:
        </span>{" "}
        {new Date(latestAudit.created_at).toLocaleString()}
      </p>

      <p>
        <span className="font-medium text-foreground">By:</span>{" "}
        {latestAudit.performer?.full_name ?? "Unknown user"}
      </p>

      <p>
        <span className="font-medium text-foreground">Email:</span>{" "}
        {latestAudit.performer?.email ?? "Unavailable"}
      </p>

      {latestAudit.reason && (
        <p>
          <span className="font-medium text-foreground pb-3">
            {latestAudit.action === "edit" ? "Summary:" : "Reason:"}
          </span>{" "}
          {latestAudit.reason}
        </p>
      )}
    </>
  )}

  {isDeleted && (
    <>
      <p className="pt-1">
        <span className="font-medium text-foreground">Deleted by:</span>{" "}
        {announcement.deleter?.full_name ?? "Unknown user"}
      </p>

      <p>
        <span className="font-medium text-foreground">Deleted:</span>{" "}
        {announcement.deleted_at
          ? new Date(announcement.deleted_at).toLocaleString()
          : "Unknown"}
      </p>

      {announcement.deletion_reason && (
        <p>
          <span className="font-medium text-foreground pb-5">
            Deletion reason:
          </span>{" "}
          {announcement.deletion_reason}
        </p>
      )}
    </>
  )}
</div>


<div className="mt-3 grid w-full grid-cols-2 gap-2 border-t border-border pt-3 sm:mt-4 sm:grid-cols-4 sm:gap-3 sm:pt-4">
  {!isDeleted && (
    <>
      {canPublishAnnouncements && (
        <Button
          type="button"
          variant="outline"
          disabled={
            isToggling ||
            toggleAnnouncement.isPending ||
            deleteAnnouncement.isPending ||
            saveAnnouncement.isPending
          }
          onClick={() => openToggleDialog(announcement)}
          className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
        >
          {isToggling ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : announcement.is_active ? (
            <PowerOff className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <Power className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          )}
          {announcement.is_active ? "Deactivate" : "Activate"}
        </Button>
      )}

      {canManageAnnouncement(announcement) && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={
              toggleAnnouncement.isPending ||
              deleteAnnouncement.isPending ||
              saveAnnouncement.isPending
            }
            onClick={() => startEditing(announcement)}
            className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Edit
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={
              toggleAnnouncement.isPending ||
              deleteAnnouncement.isPending ||
              saveAnnouncement.isPending
            }
            onClick={() => openDeleteDialog(announcement)}
            className="h-9 w-full min-w-0 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-10 sm:text-sm bg-muted"
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            )}
            Delete
          </Button>
        </>
      )}

      {isAdminOrCoAdmin && (
        <Button
          type="button"
          variant="outline"
          disabled={
            republishAnnouncement.isPending ||
            toggleAnnouncement.isPending ||
            deleteAnnouncement.isPending ||
            saveAnnouncement.isPending
          }
          onClick={() => openRepublishDialog(announcement)}
          className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
        >
          {republishAnnouncement.isPending &&
          republishAnnouncement.variables?.announcement.id ===
            announcement.id ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          )}
          Republish
        </Button>
      )}
    </>
  )}
</div>

                      {/* Audit history */}
<div className="mt-3 border-t border-border pt-2.5 sm:mt-4 sm:pt-3 text-gold">
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={() => toggleHistory(announcement.id)}
    className="h-8 px-1.5 text-[10px] sm:px-2 sm:text-xs"
  >
    <History className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />

    {isHistoryExpanded
      ? "Hide history"
      : history.length > 0
        ? `History (${history.length})`
        : "History"}

    {isHistoryExpanded ? (
      <ChevronUp className="ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
    ) : (
      <ChevronDown className="ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
    )}
  </Button>

  {isHistoryExpanded && (
    <div className="mt-2.5 space-y-3 border-l border-border pl-2.5 sm:mt-3 sm:pl-3">
      {isAuditLoading ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground sm:gap-2 sm:text-xs">
          <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
          Loading history…
        </div>
      ) : history.length > 0 ? (
        history.map((audit) => (
          <div
            key={audit.id}
            className="space-y-1 text-[10px] leading-4 sm:text-xs sm:leading-normal"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-foreground">
                {getAuditActionLabel(audit.action)}
              </span>

              <span className="text-muted-foreground">
                {new Date(audit.created_at).toLocaleString()}
              </span>
            </div>

            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                By:
              </span>{" "}
              {audit.performer?.full_name ??
                audit.performer?.email ??
                "Unknown user"}
            </p>

            {audit.reason && (
              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                <span className="font-medium text-foreground">
                  {audit.action === "edit" ? "Summary:" : "Reason:"}
                </span>{" "}
                {audit.reason}
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          No history available.
        </p>
      )}
    </div>
  )}
</div>
                    
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            No announcements match the selected filters.
          </div>
        )}
      </div>

      {/* Deleted announcements */}
      <div className="overflow-hidden rounded-sm border border-border bg-card">
        <div className="border-border p-3.5 sm:p-5">
          <h2 className="font-display text-base font-semibold sm:text-lg">
            Deleted Announcements
          </h2>

          <p className="border-b mt-0.5 pb-6 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
            Review deleted announcements, deletion reasons, and audit history.
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
              Loading deleted announcements…
            </div>
          </div>
        ) : deletedAnnouncements.length > 0 ? (
          <ul className="divide-y divide-border">
            {deletedAnnouncements.map((announcement) => {
              const history = getAnnouncementHistory(
                announcement.id,
              );

              const isHistoryExpanded =
                expandedHistoryIds.has(announcement.id);

              return (
                <li
                  key={announcement.id}
                  className="bg-card/20 p-3.5 sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-destructive sm:text-[10px]">
                        Deleted
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-medium sm:text-base">
                      {announcement.title}
                    </h3>

                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                      {announcement.body}
                    </p>

                    {announcement.link && (
                      <p className="mt-1.5 break-all text-[10px] text-primary sm:text-xs">
                        Link: {announcement.link}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-[10px] leading-4 text-muted-foreground sm:mt-3 sm:text-xs sm:leading-normal">
  <p>
    <span className="font-medium text-foreground">Created:</span>{" "}
    {new Date(announcement.created_at).toLocaleString()}
  </p>

  <p>
    <span className="font-medium text-foreground">By:</span>{" "}
    {announcement.creator?.full_name ?? "Unknown user"}
  </p>

  <p>
    <span className="font-medium text-foreground">Email:</span>{" "}
    {announcement.creator?.email ?? "Unavailable"}
  </p>

  {history.length > 0 && (
    <>
      <p className="pt-1">
        <span className="font-medium text-foreground">
          {getAuditActionLabel(history[0].action)}:
        </span>{" "}
        {new Date(history[0].created_at).toLocaleString()}
      </p>

      <p>
        <span className="font-medium text-foreground">By:</span>{" "}
        {history[0].performer?.full_name ?? "Unknown user"}
      </p>

      <p>
        <span className="font-medium text-foreground">Email:</span>{" "}
        {history[0].performer?.email ?? "Unavailable"}
      </p>

      {history[0].reason && (
        <p>
          <span className="font-medium text-foreground">
            {history[0].action === "edit" ? "Summary:" : "Reason:"}
          </span>{" "}
          {history[0].reason}
        </p>
      )}
    </>
  )}
</div>

                    {/* Audit history */}
<div className="mt-3 border-t border-border pt-2.5 sm:mt-4 sm:pt-3 text-gold">
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={() => toggleHistory(announcement.id)}
    className="h-8 px-1.5 text-[10px] sm:px-2 sm:text-xs"
  >
    <History className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />

    {isHistoryExpanded
      ? "Hide history"
      : history.length > 0
        ? `History (${history.length})`
        : "History"}

    {isHistoryExpanded ? (
      <ChevronUp className="ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
    ) : (
      <ChevronDown className="ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
    )}
  </Button>

  {isHistoryExpanded && (
    <div className="mt-2.5 space-y-3 border-l border-border pl-2.5 sm:mt-3 sm:pl-3">
      {isAuditLoading ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground sm:gap-2 sm:text-xs">
          <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
          Loading history…
        </div>
      ) : history.length > 0 ? (
        history.map((audit) => (
          <div
            key={audit.id}
            className="space-y-1 text-[10px] leading-4 sm:text-xs sm:leading-normal"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-foreground">
                {getAuditActionLabel(audit.action)}
              </span>

              <span className="text-muted-foreground">
                {new Date(audit.created_at).toLocaleString()}
              </span>
            </div>

            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                By:
              </span>{" "}
              {audit.performer?.full_name ??
                audit.performer?.email ??
                "Unknown user"}
            </p>

            {audit.reason && (
              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                <span className="font-medium text-foreground">
                  {audit.action === "edit" ? "Summary:" : "Reason:"}
                </span>{" "}
                {audit.reason}
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          No history available.
        </p>
      )}
    </div>
  )}
</div>
             </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            No deleted announcements found.
          </div>
        )}
      </div>


      {/* Edit confirmation */}
      <AlertDialog
        open={pendingEditSave}
        onOpenChange={(open) => {
          if (!open && !saveAnnouncement.isPending) {
            closeEditConfirmation();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {hasActualChanges()
                ? "Save announcement changes?"
                : "No changes were made"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {hasActualChanges()
                ? `You are about to update "${editingAnnouncement?.title}". Please provide a brief summary of what was changed.`
                : "The announcement is unchanged from its original values. No database update or audit entry will be created."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {hasActualChanges() && (
            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="announcement-edit-summary"
                className="text-xs font-medium sm:text-sm"
              >
                Edit Summary
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                id="announcement-edit-summary"
                value={editSummary}
                onChange={(event) =>
                  setEditSummary(event.target.value)
                }
                placeholder="e.g. Updated the deadline and added the submission link..."
                rows={4}
                disabled={saveAnnouncement.isPending}
                className="w-full resize-y rounded-sm border border-input bg-background px-2.5 py-2 text-xs leading-5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:px-3 sm:text-sm sm:leading-normal"
              />

              <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
                This summary will be permanently retained
                in the announcement edit history.
              </p>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={saveAnnouncement.isPending}
              className="h-9 text-xs bg-destructive sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();

                if (!hasActualChanges()) {
                  setPendingEditSave(false);
                  return;
                }

                confirmEditSave();
              }}
              disabled={
                saveAnnouncement.isPending ||
                (hasActualChanges() &&
                  !editSummary.trim())
              }
              className="h-9 bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              {hasActualChanges()
                ? "Save changes"
                : "Close"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activation / deactivation confirmation */}
      {pendingToggle && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (
              !open &&
              !toggleAnnouncement.isPending
            ) {
              closeToggleDialog();
            }
          }}
        >
          <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                {pendingToggle.nextIsActive
                  ? "Activate announcement?"
                  : "Deactivate announcement?"}
              </AlertDialogTitle>

              <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
                {pendingToggle.nextIsActive
                  ? `You are about to activate "${pendingToggle.announcement.title}". If another announcement is currently active, it will be automatically deactivated.`
                  : `You are about to deactivate "${pendingToggle.announcement.title}". This action will be recorded in the announcement audit history.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="announcement-toggle-reason"
                className="text-xs font-medium sm:text-sm"
              >
                {pendingToggle.nextIsActive
                  ? "Activation reason"
                  : "Deactivation reason"}
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                ref={toggleReasonRef}
                id="announcement-toggle-reason"
                value={toggleReason}
                onChange={(event) => {
                  setToggleReason(
                    event.target.value,
                  );
                }}
                placeholder={
                  pendingToggle.nextIsActive
                    ? "Enter the reason for activating this announcement..."
                    : "Enter the reason for deactivating this announcement..."
                }
                rows={4}
                disabled={toggleAnnouncement.isPending}
                className="w-full resize-y rounded-sm border border-input bg-background px-2.5 py-2 text-xs leading-5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:px-3 sm:text-sm sm:leading-normal"
              />

              <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
                This reason will be permanently retained
                in the announcement audit history.
              </p>
            </div>

            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel
                disabled={toggleAnnouncement.isPending}
                className="h-9 bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
              >
                Cancel
              </AlertDialogCancel>

              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleToggle();
                }}
                disabled={
                  toggleAnnouncement.isPending ||
                  !toggleReason.trim()
                }
                className="h-9 bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
              >
                {toggleAnnouncement.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                )}

                {pendingToggle.nextIsActive
                  ? "Confirm activation"
                  : "Confirm deactivation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAnnouncement.isPending) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Delete announcement?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Are you sure you want to delete{" "}
              <strong>{pendingDelete?.title}</strong>? This
              announcement will be removed from active
              announcements but retained in the admin history.
              A deletion reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-delete-reason"
              className="text-xs font-medium sm:text-sm"
            >
              Deletion reason
              <span className="ml-1 text-destructive">
                *
              </span>
            </label>

            <Input
              id="announcement-delete-reason"
              value={deleteReason}
              onChange={(event) =>
                setDeleteReason(event.target.value)
              }
              placeholder="Enter the reason for deleting this announcement..."
              disabled={deleteAnnouncement.isPending}
              required
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              This reason will be permanently retained in the
              announcement history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={deleteAnnouncement.isPending}
              className="h-9 bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={
                deleteAnnouncement.isPending ||
                !deleteReason.trim()
              }
              className="h-9 bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              {deleteAnnouncement.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              Delete announcement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Republish confirmation */}
      <AlertDialog
        open={pendingRepublish !== null}
        onOpenChange={(open) => {
          if (!open && !republishAnnouncement.isPending) {
            closeRepublishDialog();
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Republish announcement?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Republish{" "}
              <strong>{pendingRepublish?.title}</strong>?
              This will reset its previous read records so eligible
              users can be prompted to read it again. The announcement
              will be activated, and any other active announcement
              will be automatically deactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 sm:space-y-2">
            <label
              htmlFor="announcement-republish-reason"
              className="text-xs font-medium sm:text-sm"
            >
              Republish reason
              <span className="ml-1 text-destructive">*</span>
            </label>

            <textarea
              id="announcement-republish-reason"
              value={republishReason}
              onChange={(event) =>
                setRepublishReason(event.target.value)
              }
              placeholder="Explain why this announcement is being republished..."
              rows={4}
              disabled={republishAnnouncement.isPending}
              className="w-full resize-y rounded-sm border border-input bg-background px-2.5 py-2 text-xs leading-5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:px-3 sm:text-sm sm:leading-normal"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              This reason will be retained in the announcement audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={republishAnnouncement.isPending}
              className="h-9 bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleRepublish();
              }}
              disabled={
                republishAnnouncement.isPending ||
                !republishReason.trim()
              }
              className="h-9 bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
            >
              {republishAnnouncement.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              Confirm republish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
