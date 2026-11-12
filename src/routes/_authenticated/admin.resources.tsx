import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect,  useMemo,  useRef,  useState  } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, X, Edit3, Eye, Filter, FileText, History, Loader2, Search, Trash2, XCircle, ChevronLeft, ChevronRight, } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccess } from "@/hooks/useAccess";
import { downloadResource } from "@/lib/download";
import { colleges, levels, semesters, years, getDepartments, ALL_OPTION } from "@/lib/academicData";
import { getResourceScopeLabel } from "@/lib/resource-scope-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({
    meta: [
      { title: "Resources | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResourcesPage,
});

type ResourceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

type Resource = {
  id: string;
  uploader_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  course_code: string | null;
  department: string | null;
  level: string | null;
  author: string | null;
  year: number | null;
  tags: string[];
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  thumbnail_path: string | null;
  status: ResourceStatus;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  download_count: number;
  bookmark_count: number;
  approved_by: string | null;
  approved_at: string | null;
  approval_reason: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
  college: string | null;
  semester: string | null;
  category?: {
    name?: string | null;
    deleted_at?: string | null;
  } | null;
  uploader?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  approver?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  deleter?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  rejecter?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type AdminResourcesPage = {
  totalCount: number;
  page: number;
  pageSize: number;
  resources: Resource[];
};

const PAGE_SIZE = 10;

type ResourceEditAudit = {
  id: string;
  resource_id: string;
  edited_by: string;
  edit_summary: string;
  created_at: string;
  editor?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ResourceModerationAudit = {
  id: string;
  resource_id: string;
  performed_by: string;
  action: "approved" | "rejected";
  reason: string;
  created_at: string;
  performer?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type EditResourceForm = {
  title: string;
  description: string;
  course_code: string;
  college: string;
  department: string;
  level: string;
  semester: string;
  year: string;
  author: string;
  category_id: string;
  tags: string;
  edit_summary: string;
};

const STATUS_OPTIONS: Array<{
  value: "all" | ResourceStatus;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "deleted", label: "Deleted" },
  { value: "draft", label: "Draft" },
];

const UNCATEGORIZED_FILTER = "__uncategorized__";

function createEmptyEditForm(): EditResourceForm {
  return {
    title: "",
    description: "",
    course_code: "",
    college: "",
    department: "",
    level: "",
    semester: "",
    year: "",
    author: "",
    category_id: "",
    tags: "",
    edit_summary: "",
  };
}

function normalizeTags(tags: string[]) {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function getNormalizedFormValues(
  form: EditResourceForm,
) {
  const yearText = form.year.trim();

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    course_code: form.course_code.trim(),
    college: form.college.trim(),
    department: form.department.trim(),
    level: form.level.trim(),
    semester: form.semester.trim(),
    year: yearText,
    author: form.author.trim(),
    category_id: form.category_id,
    tags: normalizeTags(
      form.tags.split(","),
    ),
  };
}

function getNormalizedResourceValues(
  resource: Resource,
) {
  return {
    title: resource.title.trim(),
    description:
      resource.description?.trim() ?? "",
    course_code:
      resource.course_code?.trim() ?? "",
    college:
      resource.college?.trim() ?? "",
    department:
      resource.department?.trim() ?? "",
    level:
      resource.level?.trim() ?? "",
    semester:
      resource.semester?.trim() ?? "",
    year:
      resource.year === null
        ? ""
        : String(resource.year),
    author:
      resource.author?.trim() ?? "",
    category_id:
      resource.category_id ?? "",
    tags: normalizeTags(
      resource.tags ?? [],
    ),
  };
}

function hasActualEditChanges(
  resource: Resource,
  form: EditResourceForm,
) {
  const original =
    getNormalizedResourceValues(
      resource,
    );

  const current =
    getNormalizedFormValues(form);

  return (
    original.title !== current.title ||
    original.description !==
      current.description ||
    original.course_code !==
      current.course_code ||
    original.college !==
      current.college ||
    original.department !==
      current.department ||
    original.level !== current.level ||
    original.semester !==
      current.semester ||
    original.year !== current.year ||
    original.author !== current.author ||
    original.category_id !==
      current.category_id ||
    JSON.stringify(original.tags) !==
      JSON.stringify(current.tags)
  );
}

function ResourcesPage() {
  const { user, roles } = useAuth();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const hasAdminAccess =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

    useEffect(() => {
    if (!user) return;
    if (!roles) return;

    if (
      !roles.includes("admin") &&
      !roles.includes("co-admin")
    ) {
      void navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [user, roles, navigate]);

const [search, setSearch] = useState("");
const [status, setStatus] = useState<"all" | ResourceStatus>("all");
const [category, setCategory] = useState("all");
const [college, setCollege] = useState(ALL_OPTION);
const [department, setDepartment] = useState(ALL_OPTION);
const [level, setLevel] = useState("all");
const [semester, setSemester] = useState("all");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");

const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
const [page, setPage] = useState(1);

const resourcesTopRef = useRef<HTMLDivElement>(null);
const previousPageRef = useRef(page);
const pendingScrollRef = useRef(false);

const departments = useMemo(
  () => college !== ALL_OPTION ? getDepartments(college) : [],
  [college],
);

  const [previewResource, setPreviewResource] =
    useState<{
      id: string;
      title: string;
      file_path: string;
    } | null>(null);

  const [editingResource, setEditingResource] =
    useState<Resource | null>(null);

  const [editForm, setEditForm] =
    useState<EditResourceForm>(
      createEmptyEditForm(),
    );

  const [
    editConfirmation,
    setEditConfirmation,
  ] = useState<
    "changes" | "no_changes" | null
  >(null);

  const [
    expandedHistory,
    setExpandedHistory,
  ] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Resource | null>(null);

  const [deletionReason, setDeletionReason] =
    useState("");

  const [
    downloadingResourceId,
    setDownloadingResourceId,
  ] = useState<string | null>(null);

  const {
  data: resourcePage,
  isLoading: resourcesLoading,
  isError: resourcesError,
  refetch: refetchResources,
} = useQuery({
  queryKey: [
  "admin-resources",
  search.trim(),
  status,
  category,
  college,
  department,
  level,
  semester,
  dateFrom,
  dateTo,
  sortOrder,
  page,
],
  queryFn: async (): Promise<AdminResourcesPage> => {
    const { data, error } = await supabase.rpc("get_admin_resources", {
      p_search: search.trim(),
      p_status: status,
      p_category_id: category,
      p_college: college,
      p_department: department,
      p_level: level,
      p_semester: semester,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_sort: sortOrder,
      p_page_size: PAGE_SIZE,
      p_page: page,
    });

    if (error) {
      throw error;
    }

    const result = data as unknown as AdminResourcesPage;

    return {
      totalCount: Number(result.totalCount ?? 0),
      page: Number(result.page ?? page),
      pageSize: Number(result.pageSize ?? PAGE_SIZE),
      resources: result.resources ?? [],
    };
  },
});

const { data: categories } = useQuery({
  queryKey: ["admin-resource-categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  },
});

const resources = resourcePage?.resources ?? [];
const totalCount = resourcePage?.totalCount ?? 0;
const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

const firstResource =
  totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

const lastResource = Math.min(page * PAGE_SIZE, totalCount);


useEffect(() => {
  // Wait until the data for the current page has loaded.
  if (!resourcePage || resourcePage.page !== page) return;

  if (page > totalPages) {
    setPage(totalPages);
  }
}, [page, totalPages, resourcePage]);


/*
 * Remember that a page change requires scrolling to the resource list.
 */
useEffect(() => {
  if (previousPageRef.current === page) return;

  previousPageRef.current = page;
  pendingScrollRef.current = true;
}, [page]);

/*
 * Scroll after the requested page's data has finished loading.
 */
useEffect(() => {
  if (
    !pendingScrollRef.current ||
    resourcesLoading ||
    resourcesError ||
    !resourcePage ||
    resourcePage.page !== page
  ) {
    return;
  }

  const target = resourcesTopRef.current;

  if (!target) return;

  pendingScrollRef.current = false;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [
  page,
  resourcesLoading,
  resourcesError,
  resourcePage,
]);

  const resourceIds = useMemo(
  () => resources.map((resource) => resource.id),
  [resources],
);

  const { data: editAudits } =
    useQuery({
      queryKey: [
        "admin-resource-edit-audits",
        resourceIds,
      ],
      enabled: resourceIds.length > 0,
      queryFn: async () => {
        const {
          data: audits,
          error: auditsError,
        } = await supabase
          .from(
            "resource_edit_audit_logs",
          )
          .select(
            "id, resource_id, edited_by, edit_summary, created_at",
          )
          .in(
            "resource_id",
            resourceIds,
          )
          .order("created_at", {
            ascending: false,
          });

        if (auditsError) {
          throw auditsError;
        }

        const rows =
          (audits ??
            []) as ResourceEditAudit[];

        const editorIds = [
          ...new Set(
            rows
              .map(
                (audit) =>
                  audit.edited_by,
              )
              .filter(Boolean),
          ),
        ];

        if (
          editorIds.length === 0
        ) {
          return rows;
        }

        const {
          data: editors,
          error: editorsError,
        } = await supabase
          .from("private_profiles")
          .select(
            "id, full_name, email",
          )
          .in("id", editorIds);

        if (editorsError) {
          throw editorsError;
        }

        const editorMap = new Map(
          (editors ?? []).map(
            (editor) => [
              editor.id,
              {
                full_name:
                  editor.full_name,
                email: editor.email,
              },
            ],
          ),
        );

        return rows.map(
          (audit) => ({
            ...audit,
            editor:
              editorMap.get(
                audit.edited_by,
              ) ?? null,
          }),
        );
      },
    });

  const { data: moderationAudits } =
  useQuery({
    queryKey: [
      "admin-resource-moderation-audits",
      resourceIds,
    ],
    enabled: resourceIds.length > 0,
    queryFn: async () => {
      const {
        data: audits,
        error: auditsError,
      } = await supabase
        .from(
          "resource_moderation_audit_logs",
        )
        .select(
          "id, resource_id, performed_by, action, reason, created_at",
        )
        .in(
          "resource_id",
          resourceIds,
        )
        .order("created_at", {
          ascending: false,
        });

      if (auditsError) {
        throw auditsError;
      }

      const rows =
        (audits ??
          []) as ResourceModerationAudit[];

      const performerIds = [
        ...new Set(
          rows
            .map(
              (audit) =>
                audit.performed_by,
            )
            .filter(Boolean),
        ),
      ];

      if (
        performerIds.length === 0
      ) {
        return rows;
      }

      const {
        data: performers,
        error: performersError,
      } = await supabase
        .from("private_profiles")
        .select(
          "id, full_name, email",
        )
        .in(
          "id",
          performerIds,
        );

      if (performersError) {
        throw performersError;
      }

      const performerMap = new Map(
        (performers ?? []).map(
          (performer) => [
            performer.id,
            {
              full_name:
                performer.full_name,
              email:
                performer.email,
            },
          ],
        ),
      );

      return rows.map(
        (audit) => ({
          ...audit,
          performer:
            performerMap.get(
              audit.performed_by,
            ) ?? null,
        }),
      );
    },
  });

  const latestEditMap = useMemo(() => {
    const map = new Map<
      string,
      
      ResourceEditAudit
    >();

    for (const audit of editAudits ?? []) {
      if (
        !map.has(audit.resource_id)
      ) {
        map.set(
          audit.resource_id,
          audit,
        );
      }
    }

    return map;
  }, [editAudits]);

  const getResourceHistory = (
  resourceId: string,
) => {
  const editHistory = (
    editAudits ?? []
  )
    .filter(
      (audit) =>
        audit.resource_id ===
        resourceId,
    )
    .map((audit) => ({
      type: "edit" as const,
      id: audit.id,
      created_at:
        audit.created_at,
      editor:
        audit.editor,
      edited_by:
        audit.edited_by,
      edit_summary:
        audit.edit_summary,
    }));

  const moderationHistory = (
    moderationAudits ?? []
  )
    .filter(
      (audit) =>
        audit.resource_id ===
        resourceId,
    )
    .map((audit) => ({
      type:
        audit.action ===
        "approved"
          ? ("approved" as const)
          : ("rejected" as const),
      id: audit.id,
      created_at:
        audit.created_at,
      performer:
        audit.performer,
      performed_by:
        audit.performed_by,
      reason:
        audit.reason,
    }));

  return [
    ...editHistory,
    ...moderationHistory,
  ].sort(
    (a, b) =>
      new Date(
        b.created_at,
      ).getTime() -
      new Date(
        a.created_at,
      ).getTime(),
  );
};

  const editResource = useMutation({
    mutationFn: async ({
      resource,
      form,
    }: {
      resource: Resource;
      form: EditResourceForm;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      if (
        resource.status ===
          "deleted" ||
        resource.status ===
          "rejected"
      ) {
        throw new Error(
          "Rejected or deleted resources cannot be edited.",
        );
      }

      const title = form.title.trim();

      if (!title) {
        throw new Error(
          "Resource title is required.",
        );
      }

      const hasChanges =
        hasActualEditChanges(
          resource,
          form,
        );

      if (!hasChanges) {
        return {
          changed: false,
          id: resource.id,
        };
      }

      const editSummary =
        form.edit_summary.trim();

      if (!editSummary) {
        throw new Error(
          "An edit summary is required when changes are made.",
        );
      }

      const yearText =
        form.year.trim();

      let year: number | null =
        null;

      if (yearText) {
        const parsedYear =
          Number(yearText);

        if (
          !Number.isInteger(
            parsedYear,
          ) ||
          parsedYear < 1900 ||
          parsedYear > 2100
        ) {
          throw new Error(
            "Please enter a valid year.",
          );
        }

        year = parsedYear;
      }

      const tags =
        normalizeTags(
          form.tags.split(","),
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "admin_edit_resource",
        {
  _resource_id:
    resource.id,
  _title: title,
  _description:
    form.description.trim(),
  _course_code:
    form.course_code.trim(),
  _college:
    form.college.trim(),
  _department:
    form.department.trim(),
  _level:
    form.level.trim(),
  _semester:
    form.semester.trim(),
  _year: year as number,
  _author:
    form.author.trim(),
  _category_id:
    form.category_id,
  _tags: tags,
  _edit_summary:
    editSummary.trim(),
},
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Resource could not be updated.",
        );
      }

      return {
        changed: true,
        id: data,
      };
    },

    onSuccess: (result) => {
      setEditConfirmation(null);

      if (!result.changed) {
        toast.info(
          "No changes were made.",
        );
        return;
      }

      toast.success(
        "Resource updated and edit history recorded.",
      );

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-resource-edit-audits",
        ],
      });

      closeEdit(true);
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteResource = useMutation({
    mutationFn: async ({
      resource,
      reason,
    }: {
      resource: Resource;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      if (resource.status === "deleted") {
        throw new Error(
          "This resource is already deleted.",
        );
      }

      const normalizedReason =
        reason.trim();

      if (!normalizedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "delete-resource",
        {
          body: {
            resourceId:
              resource.id,
            deletionReason:
              normalizedReason,
          },
        },
      );

      if (error) {
        throw new Error(
          error.message ||
            "Could not delete the resource.",
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Could not delete the resource.",
        );
      }

      return data;
    },

    onSuccess: (result) => {
      if (
        result.storageCleanup ===
        "partial_failure"
      ) {
        toast.warning(
          "Resource marked as deleted, but physical Storage cleanup was incomplete.",
        );
      } else {
        toast.success(
          "Resource deleted. The file was removed and the audit record was retained.",
        );
      }

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      setPreviewResource(null);
      setPendingDelete(null);
      setDeletionReason("");
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingDelete(null);
      setDeletionReason("");
    },
  });

  const openEdit = (
    resource: Resource,
  ) => {
    setEditingResource(resource);
    setEditConfirmation(null);

    setEditForm({
      title: resource.title,
      description:
        resource.description ??
        "",
      course_code:
        resource.course_code ??
        "",
      college:
        resource.college ?? "",
      department:
        resource.department ??
        "",
      level:
        resource.level ?? "",
      semester:
        resource.semester ?? "",
      year:
        resource.year !== null
          ? String(resource.year)
          : "",
      author:
        resource.author ?? "",
      category_id:
        resource.category_id ??
        "",
      tags:
        resource.tags?.join(
          ", ",
        ) ?? "",
      edit_summary: "",
    });
  };

  const closeEdit = (force = false) => {
  if (
    editResource.isPending &&
    !force
  ) {
    return;
  }

  setEditingResource(null);
  setEditForm(
    createEmptyEditForm(),
  );
};

  const requestEditSave = () => {
    if (!editingResource) {
      return;
    }

    if (!editForm.title.trim()) {
      toast.error(
        "Resource title is required.",
      );
      return;
    }

    const hasChanges =
      hasActualEditChanges(
        editingResource,
        editForm,
      );

    setEditConfirmation(
      hasChanges
        ? "changes"
        : "no_changes",
    );
  };

  const confirmEditSave = () => {
    if (!editingResource) {
      return;
    }

    if (
      !hasActualEditChanges(
        editingResource,
        editForm,
      )
    ) {
      setEditConfirmation(null);
      return;
    }

    if (!editForm.edit_summary.trim()) {
      toast.error(
        "An edit summary is required when changes are made.",
      );
      return;
    }

    editResource.mutate({
      resource: editingResource,
      form: editForm,
    });
  };

  const handleDelete = (
    resource: Resource,
  ) => {
    setPendingDelete(resource);
    setDeletionReason("");
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const reason =
      deletionReason.trim();

    if (!reason) {
      toast.error(
        "Please provide a deletion reason before deleting this resource.",
      );
      return;
    }

    deleteResource.mutate({
      resource: pendingDelete,
      reason,
    });
  };

  const handleDownload = async (
    resource: Resource,
  ) => {
    if (
      resource.status !==
      "approved"
    ) {
      return;
    }

    if (downloadingResourceId) {
      return;
    }

    try {
      setDownloadingResourceId(
        resource.id,
      );

      await downloadResource(
        resource.id,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the resource.",
      );
    } finally {
      setDownloadingResourceId(
        null,
      );
    }
  };

  const getPersonName = (
    person:
      | {
          full_name?: string | null;
          email?: string | null;
        }
      | null
      | undefined,
    fallbackId?: string | null,
  ) => {
    return (
      person?.full_name ||
      person?.email ||
      (fallbackId
        ? `${fallbackId.slice(
            0,
            8,
          )}…`
        : "Unknown")
    );
  };

  const currentEditHasChanges =
    editingResource
      ? hasActualEditChanges(
          editingResource,
          editForm,
        )
      : false;


const selectedCategoryName =
  categories?.find(
    (category) => category.id === editForm.category_id,
  )?.name;

const isPublication = selectedCategoryName === "Publications";

const isGlobalCategory =
  isPublication ||
  selectedCategoryName === "Lecture Timetables";

const isSGS = editForm.college === "SGS";

const availableDepartments =
  editForm.college === ALL_OPTION
    ? []
    : getDepartments(editForm.college);

  if (
    user &&
    roles &&
    !hasAdminAccess
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5 sm:space-y-6">

{/* Filters */}
<div className="rounded-sm border border-border bg-card p-3 shadow-soft sm:p-4">
  <div className="mb-3 flex items-center gap-2">
    <Filter className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />

    <p
  ref={resourcesTopRef}
  className="scroll-mt-23 text-[10px] text-muted-foreground sm:text-xs"
>
  Find resources
</p>
  </div>

  <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
    {/* Search */}
    <div className="relative md:col-span-2 xl:col-span-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

      <Input
        placeholder="Search resource title, file name, uploader…"
        value={search}
        onChange={(e) => {
  setSearch(e.target.value);
  setPage(1);
}}
        className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
      />
    </div>

    {/* Status */}
    <Select
      value={status}
      onValueChange={(value) => {
  setStatus(value as "all" | ResourceStatus);
  setPage(1);
}}
    >
      <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
        <SelectValue placeholder="Status" />
      </SelectTrigger>

      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Category */}
    <Select
  value={category}
  onValueChange={(value) => {
    setCategory(value);
    setPage(1);
  }}
>
      <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
        <SelectValue placeholder="Category" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>

        <SelectItem value={UNCATEGORIZED_FILTER}>
          Uncategorized
        </SelectItem>

        {(categories ?? []).map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* College */}
    <Select
      value={college}
      onValueChange={(value) => {
  setCollege(value);
  setDepartment(ALL_OPTION);
  setPage(1);
}}
    >
      <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
        <SelectValue placeholder="College" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={ALL_OPTION}>All Colleges</SelectItem>

        {colleges.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            <>
              <span className="sm:hidden">{item.id}</span>
              <span className="hidden sm:inline">
                {item.name} ({item.id})
              </span>
            </>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Department */}
    <Select
  value={department}
  onValueChange={(value) => {
    setDepartment(value);
    setPage(1);
  }}
>
      <SelectTrigger
        className={`h-9 text-xs sm:h-10 sm:text-sm ${
          college === ALL_OPTION ? "opacity-60" : ""
        }`}
      >
        <span>
          {department === ALL_OPTION
            ? "All Departments"
            : department}
        </span>
      </SelectTrigger>

      <SelectContent>
        {college === ALL_OPTION ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Select College first
          </div>
        ) : (
          <>
            <SelectItem value={ALL_OPTION}>
              All Departments
            </SelectItem>

            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>

    {/* Level */}
    <Select
  value={level}
  onValueChange={(value) => {
    setLevel(value);
    setPage(1);
  }}
>
      <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
        <SelectValue placeholder="Level" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="all">All Levels</SelectItem>

        {levels.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Semester */}
    <Select
  value={semester}
  onValueChange={(value) => {
    setSemester(value);
    setPage(1);
  }}
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

        
{/* Sort and date range */}
<div className="col-span-full grid grid-cols-3 items-end gap-2.5 sm:gap-3">
  {/* Sort */}
  <div className="min-w-0">
    <Select
      value={sortOrder}
      onValueChange={(value) => {
        setSortOrder(value as "newest" | "oldest");
        setPage(1);
      }}
    >
      <SelectTrigger
        id="admin-resources-sort"
        className="h-9 w-full min-w-0 px-2 text-[10px] sm:h-10 sm:px-3 sm:text-sm"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
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
      onChange={(event) => {
        setDateFrom(event.target.value);
        setPage(1);
      }}
      aria-label="Filter resources from this date"
      className="block box-border h-9 w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-[10px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10 sm:px-2 sm:text-sm"
    />
  </div>

  {/* Date to */}
  <div className="min-w-0">
    <input
      id="library-date-to"
      type="date"
      value={dateTo}
      min={dateFrom || undefined}
      onChange={(event) => {
        setDateTo(event.target.value);
        setPage(1);
      }}
      aria-label="Filter resources up to this date"
      className="block box-border h-9 w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-[10px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10 sm:px-2 sm:text-sm"
    />
  </div>
</div>
</div>

  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="pl-2 text-[10px] text-gold sm:text-xs">
  Showing {firstResource}–{lastResource} of {totalCount} resources
</p>
      {(search.trim() !== "" ||
        status !== "all" ||
        category !== "all" ||
        college !== ALL_OPTION ||
        department !== ALL_OPTION ||
        level !== "all" ||
        semester !== "all" ||
        dateFrom !== "" ||
        dateTo !== "" ||
        sortOrder !== "newest") && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setCategory("all");
            setCollege(ALL_OPTION);
            setDepartment(ALL_OPTION);
            setLevel("all");
            setSemester("all");
            setDateFrom("");
            setDateTo("");
            setSortOrder("newest");
            setPage(1);
          }}
  className="h-7 px-2 pr-3 text-xs text-gold sm:h-8"
>
  <X className="h-3.5 w-3.5" />
  Clear filters
</Button>
      )}
    </div>
</div>

      {/* Resource list */}
      <div>
        <div className="overflow-hidden rounded-sm border border-border bg-card shadow-soft sm:rounded-sm">
        {resourcesLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            Loading resources…
          </div>
        ) : resources.length > 0 ? (
          <ul className="divide-y-0">
            {resources.map(
              (resource) => {
                const isDeleting =
                  deleteResource.isPending &&
                  deleteResource.variables
                    ?.resource.id ===
                    resource.id;

                const isEditing =
                  editResource.isPending &&
                  editResource.variables
                    ?.resource.id ===
                    resource.id;

                const isDownloading =
                  downloadingResourceId ===
                  resource.id;

                const isDeleted =
                  resource.status ===
                  "deleted";

                const categoryName =
                  resource.category
                    ?.deleted_at ==
                    null &&
                  resource.category?.name
                    ?.trim()
                    ? resource.category.name.trim()
                    : "Uncategorized";

                const latestEdit =
                  latestEditMap.get(
                    resource.id,
                  );

                const history =
                  getResourceHistory(
                    resource.id,
                  );

                const isHistoryOpen =
                  expandedHistory ===
                  resource.id;

                const canPreview =
                  resource.file_size >
                    0 &&
                  (resource.status ===
                    "pending" ||
                    resource.status ===
                      "approved");

                const canDownload =
                  resource.status ===
                  "approved";

                const canEdit =
                  isAdmin &&
                  resource.status !==
                    "deleted" &&
                  resource.status !==
                    "rejected";

                const canDelete =
                  isAdmin &&
                  resource.status !==
                    "rejected" &&
                  resource.status !==
                    "deleted";

                return (
                  <li
                    key={resource.id}
                    className={`group border-b border-border/70 p-3.5 transition-colors sm:border-b-2 sm:p-5 ${
                      isDeleted
                        ? "bg-muted/30"
                        : "odd:bg-card even:bg-muted/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Resource header */}
                      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <StatusPill
                              status={
                                resource.status
                              }
                            />

                            <span className="max-w-[180px] truncate rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px] sm:px-2 sm:text-[10px]">
                              {
                                categoryName
                              }
                            </span>
                          </div>

                          <div className="mt-2 min-w-0">
                            <p
                              className={`break-words text-sm font-semibold leading-5 sm:text-lg sm:leading-6 ${
                                isDeleted
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {
                                resource.title
                              }
                            </p>

                            <p className="mt-1 break-all text-[10px] text-muted-foreground sm:text-xs">
                              {
                                resource.file_name
                              }
                            </p>

                            {resource.description && (
                              <p className="mt-2 max-w-4xl line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                                {
                                  resource.description
                                }
                              </p>
                            )}
                          </div>

                          
{/* Resource metadata */}
<div className="mt-3 grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
  <AuditItem
    label="File size"
    value={formatFileSize(resource.file_size)}
  />

  {resource.course_code?.trim() && (
    <AuditItem
      label="Course code"
      value={resource.course_code.trim()}
    />
  )}

  {resource.college?.trim() && (
    <AuditItem
      label="College"
      value={getResourceScopeLabel(resource.college, "college")}
    />
  )}

  {resource.department?.trim() && (
    <AuditItem
      label="Department"
      value={getResourceScopeLabel(resource.department, "department")}
    />
  )}

  {resource.level?.trim() && (
    <AuditItem
      label="Level"
      value={getResourceScopeLabel(resource.level, "level")}
    />
  )}

  {resource.semester?.trim() && (
    <AuditItem
      label="Semester"
      value={getResourceScopeLabel(resource.semester, "semester")}
    />
  )}

  {resource.year && (
    <AuditItem
      label="Year"
      value={String(resource.year)}
    />
  )}
</div>
</div>
</div>

                      {/* Usage metrics */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between rounded-sm border border-border bg-muted/20 px-2.5 py-1.5 sm:block sm:px-3 sm:py-2">
                          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px] sm:tracking-[0.12em]">
                            Downloads
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-foreground sm:text-sm">
                            {resource.download_count.toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between rounded-sm border border-border bg-muted/20 px-2.5 py-1.5 sm:block sm:px-3 sm:py-2">
                          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px] sm:tracking-[0.12em]">
                            Bookmarks
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-foreground sm:text-sm">
                            {resource.bookmark_count.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Audit information */}
                      <div className="grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
                        <AuditItem
                          label="Uploader"
                          value={getPersonName(
                            resource.uploader,
                            resource.uploader_id,
                          )}
                          detail={formatDateTime(
                            resource.created_at,
                          )}
                        />

                        {resource.status ===
                        "rejected" ? (
                          <>
                            <AuditItem
                              label="Rejected by"
                              value={
                                resource.rejected_by
                                  ? getPersonName(
                                      resource.rejecter,
                                      resource.rejected_by,
                                    )
                                  : "Unknown"
                              }
                              detail={
                                resource.rejected_at
                                  ? formatDateTime(
                                      resource.rejected_at,
                                    )
                                  : undefined
                              }
                            />

                            {resource.rejection_reason && (
                              <AuditItem
                                label="Rejection reason"
                                value={
                                  resource.rejection_reason
                                }
                              />
                            )}
                          </>
                        ) : (
  <>
    <AuditItem
      label="Approved by"
      value={
        resource.approved_by
          ? getPersonName(
              resource.approver,
              resource.approved_by,
            )
          : "Not approved"
      }
      detail={
        resource.approved_at
          ? formatDateTime(
              resource.approved_at,
            )
          : undefined
      }
    />

    {resource.status === "approved" &&
      resource.approval_reason && (
        <AuditItem
          label="Approval reason"
          value={
            resource.approval_reason
          }
        />
      )}
  </>
)}

                        <AuditItem
                          label="Deleted by"
                          value={
                            resource.deleted_by
                              ? getPersonName(
                                  resource.deleter,
                                  resource.deleted_by,
                                )
                              : "Not deleted"
                          }
                          detail={
                            resource.deleted_at
                              ? formatDateTime(
                                  resource.deleted_at,
                                )
                              : undefined
                          }
                        />

                        {latestEdit && (
                          <>
                            <AuditItem
                              label="Last edited by"
                              value={getPersonName(
                                latestEdit.editor,
                                latestEdit.edited_by,
                              )}
                              detail={formatDateTime(
                                latestEdit.created_at,
                              )}
                            />

                            <AuditItem
                              label="Edit summary"
                              value={
                                latestEdit.edit_summary
                              }
                            />
                          </>
                        )}

                        {resource.status ===
                          "deleted" &&
                          resource.deletion_reason && (
                            <AuditItem
                              label="Deletion reason"
                              value={
                                resource.deletion_reason
                              }
                            />
                          )}
                      </div>

                      {/* Resource history */}
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedHistory(
                              isHistoryOpen
                                ? null
                                : resource.id,
                            )
                          }
                          className="h-8 px-2 text-[10px] text-gold sm:h-7 sm:text-xs"
                        >
                          <History className="mr-1.5 h-3.5 w-3.5 text-gold"/>

                          {isHistoryOpen
                            ? "Hide history"
                            : `History (${history.length})`}
                        </Button>

                        {isHistoryOpen && (
                          <div className="mt-2 border-l border-border pl-3 sm:pl-4">
                            {history.length >
                            0 ? (
                              <div className="space-y-2.5 sm:space-y-3">
                                {history.map((log) => (
  <div
    key={`${log.type}-${log.id}`}
    className="text-[10px] sm:text-xs "
  >
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium uppercase">
        {log.type === "edit"
          ? "Edit"
          : log.type === "approved"
            ? "Approve"
            : "Reject"}
      </span>

      <span className="text-muted-foreground">
        {formatDateTime(
          log.created_at,
        )}
      </span>
    </div>

    {log.type === "edit" ? (
      <>
        <p className="mt-0.5 text-muted-foreground">
          By{" "}
          {getPersonName(
            log.editor,
            log.edited_by,
          )}
        </p>

        <p className="mt-1 text-muted-foreground">
          Summary:{" "}
          {log.edit_summary}
        </p>
      </>
    ) : (
      <>
        <p className="mt-0.5 text-muted-foreground">
          By{" "}
          {getPersonName(
            log.performer,
            log.performed_by,
          )}
        </p>

        <p className="mt-1 text-muted-foreground">
          Reason: {log.reason}
        </p>
      </>
    )}
  </div>
))}
                              </div>
                            ) : (
                              <p className="py-2 text-xs text-muted-foreground">
                                No history yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      
{/* Resource actions */}
<div className="grid w-full grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4 sm:gap-3 sm:pt-4">
  {canPreview && (
    <Button
      type="button"
      variant="outline"
      disabled={
        editResource.isPending ||
        deleteResource.isPending ||
        Boolean(downloadingResourceId)
      }
      onClick={() =>
        setPreviewResource({
          id: resource.id,
          title: resource.title,
          file_path: resource.file_path,
        })
      }
      className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
    >
      <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0"/>
      Preview
    </Button>
  )}

  {canDownload && (
    <Button
      type="button"
      variant="outline"
      disabled={
        editResource.isPending ||
        deleteResource.isPending ||
        Boolean(downloadingResourceId)
      }
      onClick={() => handleDownload(resource)}
      className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
    >
      {isDownloading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5 shrink-0" />
      )}
      Download
    </Button>
  )}

  {canEdit && (
    <Button
      type="button"
      variant="outline"
      disabled={
        editResource.isPending ||
        deleteResource.isPending ||
        Boolean(downloadingResourceId)
      }
      onClick={() => openEdit(resource)}
      className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm bg-muted"
    >
      {isEditing ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Edit3 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
      )}
      Edit
    </Button>
  )}

  {canDelete && (
    <Button
      type="button"
      variant="outline"
      disabled={
        editResource.isPending ||
        deleteResource.isPending ||
        Boolean(downloadingResourceId)
      }
      onClick={() => handleDelete(resource)}
      className="h-9 w-full min-w-0 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-10 sm:text-sm bg-muted"
    >
      {isDeleting ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Trash2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
      )}
      Delete
    </Button>
  )}
</div>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        ) : resourcesError ? (
  <div className="p-6 text-center sm:p-10">
    <p className="text-sm text-destructive">
      Failed to load resources.
    </p>

    <Button
      type="button"
      variant="outline"
      className="mt-3"
      onClick={() => refetchResources()}
    >
      Retry
    </Button>
  </div>
) : totalCount === 0 &&
  (search.trim() !== "" ||
    status !== "all" ||
    category !== "all" ||
    college !== ALL_OPTION ||
    department !== ALL_OPTION ||
    level !== "all" ||
    semester !== "all") ? (
  <div className="p-6 text-center sm:p-10">
    <Search className="mx-auto h-7 w-7 text-muted-foreground/50 sm:h-8 sm:w-8" />

    <p className="mt-2.5 text-xs font-medium sm:mt-3 sm:text-sm">
      No matching resources
    </p>

    <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
      Try changing your search or filters.
    </p>
  </div>
) : (
  <EmptyState
    title="No resources yet"
    desc="Resources uploaded to the library will appear here."
  />
)}
      </div>
      </div>

      {/* Pagination */}
      {!resourcesLoading &&
        !resourcesError &&
        totalCount > 0 && (
          <div className="border-t border-border pt-4">
            {totalPages > 1 && (
              <div className="grid grid-cols-3 items-center gap-2">
                {/* Previous: far left */}
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || resourcesLoading}
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
                    disabled={
                      page >= totalPages || resourcesLoading
                    }
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

      {/* Edit resource dialog */}
      <AlertDialog
        open={
          editingResource !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !editConfirmation &&
            !editResource.isPending
          ) {
            closeEdit();
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-sm p-4 sm:max-w-3xl sm:rounded-sm sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Edit resource
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Update the resource metadata using
              the same academic details used during
              upload. The uploaded file itself will
              not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          
<div className="grid gap-4">
  {/* Resource title */}
  <div className="space-y-2">
    <Label htmlFor="edit-resource-title">
      Resource title
    </Label>
    <Input
      id="edit-resource-title"
      value={editForm.title}
      onChange={(event) =>
        setEditForm((current) => ({
          ...current,
          title: event.target.value,
        }))
      }
      placeholder="Enter resource title"
      disabled={editResource.isPending}
    />
  </div>

  {/* Description */}
  <div className="space-y-2">
    <Label htmlFor="edit-resource-description">
      Description
    </Label>
    <Textarea
      id="edit-resource-description"
      value={editForm.description}
      onChange={(event) =>
        setEditForm((current) => ({
          ...current,
          description: event.target.value,
        }))
      }
      placeholder="Describe the resource"
      rows={4}
      disabled={editResource.isPending}
    />
  </div>

  {/* Category */}
  <div className="space-y-2">
    <Label htmlFor="edit-resource-category">
      Category
    </Label>
    <Select
      value={editForm.category_id || "uncategorized"}
      
onValueChange={(value) => {
  const categoryId =
    value === "uncategorized" ? "" : value;

  const selectedCategory = categories?.find(
    (category) => category.id === categoryId,
  );

  const selectedIsGlobalCategory =
    selectedCategory?.name === "Publications" ||
    selectedCategory?.name === "Lecture Timetables";

  const currentIsGlobalCategory =
    categories?.some(
      (category) =>
        category.id === editForm.category_id &&
        (category.name === "Publications" ||
          category.name === "Lecture Timetables"),
    ) ?? false;

  setEditForm((current) => ({
    ...current,
    category_id: categoryId,
    ...(selectedIsGlobalCategory ||
    currentIsGlobalCategory
      ? {
          college: "",
          department: "",
          level: "",
          course_code: "",
        }
      : {}),
  }));
}}

      disabled={editResource.isPending}
    >
      <SelectTrigger id="edit-resource-category">
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="uncategorized">
          Uncategorized
        </SelectItem>
        {(categories ?? []).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  
{/* College and Department */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {/* College */}
    <div className="space-y-2">
      <Label className="text-xs sm:text-sm">
        College
      </Label>

      <Select
        value={editForm.college || "none"}
        onValueChange={(value) =>
          setEditForm((current) => ({
            ...current,
            college:
              value === "none" ? "" : value,
            department: "",
          }))
        }
        disabled={editResource.isPending}
      >
        <SelectTrigger id="edit-resource-college">
          <SelectValue placeholder="Select college" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="none">
            Select college
          </SelectItem>

          {isGlobalCategory && (
            <SelectItem value={ALL_OPTION}>
              All Colleges
                          </SelectItem>
                        )}
              
                        {colleges.map((college) => (
                          <SelectItem
                            key={college.id}
                            value={college.id}
                            className="text-xs sm:text-sm"
                          >
                            <>
                              <span className="sm:hidden">
                                {college.id}
                              </span>
              
                              <span className="hidden sm:inline">
                                {college.name} ({college.id})
                              </span>
                            </>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

{/* Department */}
{(!isSGS ||
  isGlobalCategory ||
  availableDepartments.length > 0) && (
  <div className="space-y-2">
    <Label htmlFor="edit-resource-department">
      Department
    </Label>

    <Select
      value={editForm.department || "none"}
      onValueChange={(value) =>
        setEditForm((current) => ({
          ...current,
          department: value === "none" ? "" : value,
        }))
      }
      disabled={
        editResource.isPending ||
        !editForm.college ||
        editForm.college === "none"
      }
    >
      <SelectTrigger id="edit-resource-department">
        <SelectValue
          placeholder={
            editForm.college && editForm.college !== "none"
              ? "Select department"
              : "Select college first"
          }
        />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="none">
          {!editForm.college || editForm.college === "none"
            ? "Select college first"
            : "Select department"}
        </SelectItem>

        {(isGlobalCategory || isSGS) && (
          <SelectItem value={ALL_OPTION}>
            All Departments
          </SelectItem>
        )}

        {availableDepartments.map((department) => (
          <SelectItem key={department} value={department}>
            {department}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
</div>

{/* Level, Semester and Upload Year */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {isGlobalCategory ? (
  <div className="space-y-2">
    <Label htmlFor="edit-resource-level">
      Level
    </Label>
    <Select
      value={editForm.level || "none"}
      onValueChange={(value) =>
        setEditForm((current) => ({
          ...current,
          level: value === "none" ? "" : value,
        }))
      }
      disabled={editResource.isPending}
    >
      <SelectTrigger id="edit-resource-level">
        <SelectValue placeholder="Select level" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          Select level
        </SelectItem>
        <SelectItem value={ALL_OPTION}>
          All Levels
        </SelectItem>
        {levels.map((level) => (
          <SelectItem key={level} value={level}>
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
) : (
      <div className="space-y-2">
        <Label htmlFor="edit-resource-level">
          Level
        </Label>
        <Select
          value={editForm.level || "none"}
          onValueChange={(value) =>
            setEditForm((current) => ({
              ...current,
              level: value === "none" ? "" : value,
            }))
          }
          disabled={editResource.isPending}
        >
          <SelectTrigger id="edit-resource-level">
            <SelectValue placeholder="Select level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              Select level
            </SelectItem>
            {isGlobalCategory && (
            <SelectItem value={ALL_OPTION}>
            All Levels
            </SelectItem>
            )}
            {levels.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}

  {/* Course code */}
  {!isGlobalCategory && (
    <div className="space-y-2">
      <Label htmlFor="edit-resource-course-code">
        Course code
      </Label>
      <Input
        id="edit-resource-course-code"
        value={editForm.course_code}
        onChange={(event) =>
          setEditForm((current) => ({
            ...current,
            course_code: event.target.value,
          }))
        }
        placeholder="e.g. CSC 499"
        disabled={editResource.isPending}
      />
    </div>
  )}

    <div className="space-y-2">
  <Label htmlFor="edit-resource-semester">
    Semester
  </Label>

  <Select
    value={editForm.semester || "none"}
    onValueChange={(value) =>
      setEditForm((current) => ({
        ...current,
        semester: value === "none" ? "" : value,
      }))
    }
    disabled={editResource.isPending}
  >
    <SelectTrigger id="edit-resource-semester">
      <SelectValue placeholder="Select semester" />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="none">
        Select semester
      </SelectItem>

      {isGlobalCategory && (
        <SelectItem value="Both Semesters">
          Both Semesters
        </SelectItem>
      )}

      {semesters.map((semester) => (
        <SelectItem key={semester} value={semester}>
          {semester}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

    <div className="space-y-2">
      <Label htmlFor="edit-resource-year">
        Year of Upload
      </Label>
      <Select
        value={editForm.year || "none"}
        onValueChange={(value) =>
          setEditForm((current) => ({
            ...current,
            year: value === "none" ? "" : value,
          }))
        }
        disabled={editResource.isPending}
      >
        <SelectTrigger id="edit-resource-year">
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            Select year
          </SelectItem>
          {years.map((year) => (
            <SelectItem key={String(year)} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
</div>

          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              disabled={
                editResource.isPending
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                requestEditSave();
              }}
              disabled={
                editResource.isPending ||
                !editForm.title.trim()
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

            {/* Edit save confirmation */}
      <AlertDialog
        open={
          editConfirmation !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !editResource.isPending
          ) {
            setEditConfirmation(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm p-4 sm:max-w-lg sm:rounded-sm sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {editConfirmation ===
              "no_changes"
                ? "No changes detected"
                : "Save resource changes?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {editConfirmation ===
              "no_changes" ? (
                <>
                  No resource details have changed.
                  Saving now will not modify the
                  resource or create an edit-history
                  entry.
                </>
              ) : (
                <>
                  You are about to update the details
                  of{" "}
                  <strong>
                    {editingResource?.title}
                  </strong>
                  . This change will be recorded in
                  the resource edit history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {editConfirmation ===
            "changes" && (
            <div className="space-y-2">
              <label
                htmlFor="resource-edit-summary"
                className="text-xs font-medium sm:text-sm"
              >
                Edit summary
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                id="resource-edit-summary"
                value={
                  editForm.edit_summary
                }
                onChange={(event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      edit_summary:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Briefly explain what was changed and why…"
                disabled={
                  editResource.isPending
                }
                rows={3}
                maxLength={500}
                autoFocus
                className="flex min-h-20 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
              />

              <p className="text-[10px] text-muted-foreground sm:text-xs">
                This summary will be permanently
                retained in the resource edit history.
              </p>
            </div>
          )}

          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            {editConfirmation ===
            "no_changes" ? (
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  setEditConfirmation(null);
                }}
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
              >
                Close
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel
                  disabled={
                    editResource.isPending
                  }
                  className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                >
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    confirmEditSave();
                  }}
                  disabled={
                    editResource.isPending ||
                    !editForm.edit_summary.trim()
                  }
                  className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                >
                  {editResource.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                  )}

                  Save changes
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview */}
      {previewResource && (
        <PreviewModal
          resource={
            previewResource
          }
          onClose={() =>
            setPreviewResource(null)
          }
        />
      )}

            {/* Delete confirmation dialog */}
      <AlertDialog
        open={
          pendingDelete !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !deleteResource.isPending
          ) {
            setPendingDelete(null);
            setDeletionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm p-4 sm:max-w-lg sm:rounded-sm sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Confirm resource deletion
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              Delete{" "}
              <strong>
                {
                  pendingDelete?.title
                }
              </strong>
              ? The physical file will be
              permanently removed from Storage,
              but the database record will be
              retained for audit/history.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="deletion-reason"
              className="text-xs font-medium sm:text-sm"
            >
              Deletion reason
            </label>

            <Input
              id="deletion-reason"
              value={deletionReason}
              onChange={(event) =>
                setDeletionReason(
                  event.target.value,
                )
              }
              placeholder="e.g. Duplicate resource or incorrect material"
              disabled={
                deleteResource.isPending
              }
              required
              aria-required="true"
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] text-muted-foreground sm:text-xs">
              A reason is required and will be
              retained with the resource audit
              record.
            </p>
          </div>

          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              disabled={
                deleteResource.isPending
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={
                deleteResource.isPending ||
                !deletionReason.trim()
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              {deleteResource.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium sm:text-sm">
        {label}

        {required && (
          <span className="ml-1 text-destructive">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: ResourceStatus;
}) {
  const config: Record<
    ResourceStatus,
    {
      label: string;
      className: string;
      icon: typeof CheckCircle2;
    }
  > = {
    approved: {
      label: "Approved",
      className:
        "border-primary/20 bg-primary/10 text-primary",
      icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      className:
        "border-gold/20 bg-gold/10 text-gold",
      icon: Clock3,
    },
    rejected: {
      label: "Rejected",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    deleted: {
      label: "Deleted",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: Trash2,
    },
    draft: {
      label: "Draft",
      className:
        "border-border bg-muted/30 text-muted-foreground",
      icon: FileText,
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2 sm:text-[10px] ${item.className}`}
    >
      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      {item.label}
    </span>
  );
}

function AuditItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-l-2 border-border pl-3">
      <p className="uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 font-medium text-foreground">
        {value}
      </p>

      {detail && (
        <p className="mt-0.5 text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

function formatDateTime(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleString();
}

function formatFileSize(
  bytes: number,
) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
}

function PreviewModal({
  resource,
  onClose,
}: {
  resource: {
    id: string;
    title: string;
    file_path: string;
  };
  onClose: () => void;
}) {
  const [scrollRoot, setScrollRoot] =
  useState<HTMLDivElement | null>(null);

  const {
    data: previewUrl,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "admin-resource-preview-url",
      resource.id,
    ],
    queryFn: async () => {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      return {
        url:
         `${import.meta.env.VITE_SUPABASE_URL}` +
         `/functions/v1/preview-resource`,
        accessToken:
        session.access_token,
      };
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl sm:max-h-[95vh] sm:rounded-sm">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium sm:text-sm">
              {resource.title}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              Resource preview
            </p>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
            className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
          >
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <div
          ref={setScrollRoot}
          className="min-h-0 flex-1 overflow-auto p-2.5 sm:p-4"
        >
          {isLoading ? (
            <div className="flex min-h-[60vh] items-center justify-center text-xs text-muted-foreground sm:text-sm">
              Preparing preview…
            </div>
          ) : error ? (
            <div className="flex min-h-[60vh] items-center justify-center text-center text-xs text-destructive sm:text-sm">
              {error instanceof Error
                ? error.message
                : "Preview could not be prepared."}
            </div>
          ) : previewUrl ? (
            <DocumentPreview
              url={previewUrl.url}
              token={previewUrl.accessToken}
              resourceId={resource.id}
              context="resources"
              filePath={resource.file_path}
              title={resource.title}
              scrollRoot={scrollRoot}
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center text-xs text-muted-foreground sm:text-sm">
              Preview unavailable.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}