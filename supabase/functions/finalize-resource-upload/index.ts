import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_METADATA_LENGTH = 150;

const ALL_OPTION = "all";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "application/zip",
]);

const ALLOWED_ROLES = new Set([
  "admin",
  "co-admin",
  "lecturer",
  "staff",
  "student",
  "researcher",
]);

// Keep these definitions synchronized with academicData.ts.
const COLLEGES: Record<string, readonly string[]> = {
  CAERSE: [
    "Agribusiness and Management",
    "Agricultural Economics",
    "Agricultural Extension and Rural Sociology",
  ],

  CASAP: [
    "Animal Breeding And Physiology",
    "Animal Nutrition And Forage Science",
    "Animal Production and Livestock Management",
  ],

  CAFST: [
    "Human Nutrition and Dietetics",
    "Home Science/Hospitality Management & Tourism",
    "Food Science and Technology",
  ],

  CCSS: [
    "Agronomy",
    "Plant Health Management",
    "Soil Science and Meteorology",
    "Water Resources Management and Agrometeorology",
  ],

  COED: [
    "Adult and Continuing Education",
    "Agricultural/Home Science Education",
    "Business Education",
    "Economics Education",
    "Education Management",
    "Industrial Technology Education",
    "Library and Information Science",
    "Guidance and Counselling",
    "Integrated Science Education",
  ],

  CEET: [
    "Agricultural and Bioresources Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Computer Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
  ],

  COLMAS: [
    "Marketing",
    "Accounting",
    "Banking and Finance",
    "Economics",
    "Industrial Relations and Personnel Management",
    "Entrepreneurial Studies",
    "Business Administration",
  ],

  CNREM: [
    "Environment Management and Toxicology",
    "Fisheries and Aquatic Resources Management",
    "Forestry and Environmental Management",
  ],

  COLNAS: [
    "Biochemistry",
    "Microbiology",
    "Plant Science and Biotechnology",
    "Zoology and Environmental Biology",
  ],

  COLPAS: [
    "Chemistry",
    "Computer Science",
    "Geology",
    "Mathematics",
    "Physics",
    "Statistics",
  ],

  CVM: [
    "Theriogenology",
    "Veterinary Anatomy",
    "Veterinary Medicine",
    "Veterinary Microbiology",
    "Veterinary Public Health and Preventive Medicine",
    "Veterinary Surgery and Radiology",
  ],

  SGS: [
    "English",
    "French",
    "German",
    "History",
    "Social Science",
    "Physical and Health",
    "Philosophy",
    "Peace and Conflict",
  ],
};

const GLOBAL_CATEGORIES = new Set([
  "Publications",
  "Lecture Timetables",
]);

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "private, no-store",
    },
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  value: unknown,
  fallback = "",
): string | null {
  if (value === undefined || value === null) {
    return fallback;
  }

  return typeof value === "string" ? value.trim() : null;
}

function getSafeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function normalizeNullableString(
  value: string | null | undefined,
) {
  return value || null;
}

/**
 * Validates the selected college and department.
 *
 * Ordinary categories:
 * - Require a real college.
 * - Require a department belonging to that college.
 * - SGS additionally permits the "all" department option.
 *
 * Global categories:
 * - Permit "all" or a specific college.
 * - A specific college permits "all" or one of its departments.
 * - "all" colleges cannot be combined with a specific department.
 *
 * Drafts may have incomplete academic selections, but any
 * selections already supplied must be valid.
 */
function validateAcademicSelection({
  isGlobalCategory,
  status,
  college,
  department,
}: {
  isGlobalCategory: boolean;
  status: string;
  college: string;
  department: string;
}): string | null {
  const hasCollege = college.length > 0;
  const hasDepartment = department.length > 0;

  if (isGlobalCategory) {
    if (hasCollege) {
      if (
        college !== ALL_OPTION &&
        !Object.hasOwn(COLLEGES, college)
      ) {
        return "Select a valid college.";
      }
    }

    if (college === ALL_OPTION) {
      if (
        hasDepartment &&
        department !== ALL_OPTION
      ) {
        return "All Colleges cannot be combined with a specific department.";
      }

      return null;
    }

    if (hasDepartment && department !== ALL_OPTION) {
      if (!hasCollege) {
        return "Select a college before choosing a department.";
      }

      const allowedDepartments = COLLEGES[college];

      if (
        !allowedDepartments ||
        !allowedDepartments.includes(department)
      ) {
        return "The selected department does not belong to the selected college.";
      }
    }

    return null;
  }

  // Ordinary academic categories cannot use All Colleges.
  if (college === ALL_OPTION) {
    return "Select a specific college for this category.";
  }

  if (hasCollege && !Object.hasOwn(COLLEGES, college)) {
    return "Select a valid college.";
  }

  // Allow incomplete drafts.
  if (!hasCollege || !hasDepartment) {
    if (
      status === "pending" &&
      (!hasCollege || !hasDepartment)
    ) {
      return "Select a college and department before submitting for review.";
    }

    if (department === ALL_OPTION && college !== "SGS") {
      return "All Departments is only available for SGS in this category.";
    }

    return null;
  }

  const allowedDepartments = COLLEGES[college];

  if (department === ALL_OPTION) {
    if (college !== "SGS") {
      return "All Departments is only available for SGS in this category.";
    }

    return null;
  }

  if (!allowedDepartments.includes(department)) {
    return "The selected department does not belong to the selected college.";
  }

  return null;
}

/**
 * Checks whether an existing operation belongs to the same
 * upload request.
 *
 * The resource's current moderation status is deliberately
 * excluded because it may have changed after the original upload.
 */
function matchesExistingUpload(
  existing: Record<string, unknown>,
  request: {
    fileName: string;
    title: string;
    description: string;
    courseCode: string;
    college: string;
    department: string;
    semester: string;
    level: string;
    categoryId: string | null;
    fileSize: number;
    mimeType: string;
    year: number | null;
  },
) {
  return (
    existing.file_name === request.fileName &&
    existing.title === request.title &&
    normalizeNullableString(
      existing.description as string | null,
    ) === normalizeNullableString(request.description) &&
    normalizeNullableString(
      existing.course_code as string | null,
    ) === normalizeNullableString(request.courseCode) &&
    normalizeNullableString(
      existing.college as string | null,
    ) === normalizeNullableString(request.college) &&
    normalizeNullableString(
      existing.department as string | null,
    ) === normalizeNullableString(request.department) &&
    normalizeNullableString(
      existing.semester as string | null,
    ) === normalizeNullableString(request.semester) &&
    normalizeNullableString(
      existing.level as string | null,
    ) === normalizeNullableString(request.level) &&
    existing.category_id === request.categoryId &&
    existing.file_size === request.fileSize &&
    existing.mime_type === request.mimeType &&
    existing.year === request.year
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
  }

  try {
    // -----------------------------------------------
    // 1. Authenticate the requesting user.
    // -----------------------------------------------

    const authorization =
      req.headers.get("Authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Unauthorized." },
        401,
      );
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return jsonResponse(
        { error: "Unauthorized." },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(
        "Upload service environment configuration is incomplete.",
      );

      return jsonResponse(
        { error: "Upload service is not configured." },
        500,
      );
    }

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: "Unauthorized." },
        401,
      );
    }

    // -----------------------------------------------
    // 2. Parse and validate the request.
    // -----------------------------------------------

    let body: Record<string, unknown>;

    try {
      const parsedBody = await req.json();

      if (!isRecord(parsedBody)) {
        return jsonResponse(
          { error: "Invalid request body." },
          400,
        );
      }

      body = parsedBody;
    } catch {
      return jsonResponse(
        { error: "Invalid JSON request body." },
        400,
      );
    }

    const uploadOperationId =
      typeof body.uploadOperationId === "string"
        ? body.uploadOperationId.trim()
        : "";

    const status = body.status;

    const fileName = getString(body.fileName);
    const title = getString(body.title);
    const description = getString(body.description);
    const courseCode = getString(body.course_code);
    const college = getString(body.college);
    const department = getString(body.department);
    const semester = getString(body.semester);
    const level = getString(body.level);

    const categoryId =
      body.category_id === null || body.category_id === ""
        ? null
        : typeof body.category_id === "string"
          ? body.category_id.trim()
          : undefined;

    const fileSize = body.fileSize;
    const mimeType = getString(body.mimeType, "");

    const year =
      body.year === null || body.year === ""
        ? null
        : Number(body.year);

    if (!isValidUuid(uploadOperationId)) {
      return jsonResponse(
        { error: "Invalid upload operation ID." },
        400,
      );
    }

    if (status !== "draft" && status !== "pending") {
      return jsonResponse(
        { error: "Invalid resource status." },
        400,
      );
    }

    if (
      !fileName ||
      fileName.length > MAX_FILENAME_LENGTH ||
      !title ||
      title.length > MAX_TITLE_LENGTH ||
      description === null ||
      description.length > MAX_DESCRIPTION_LENGTH ||
      courseCode === null ||
      courseCode.length > MAX_METADATA_LENGTH ||
      college === null ||
      college.length > MAX_METADATA_LENGTH ||
      department === null ||
      department.length > MAX_METADATA_LENGTH ||
      semester === null ||
      semester.length > MAX_METADATA_LENGTH ||
      level === null ||
      level.length > MAX_METADATA_LENGTH ||
      categoryId === undefined ||
      mimeType === null ||
      typeof fileSize !== "number" ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_SIZE ||
      (!Number.isInteger(year) && year !== null)
    ) {
      return jsonResponse(
        { error: "Invalid or incomplete upload metadata." },
        400,
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonResponse(
        { error: "Unsupported file type." },
        400,
      );
    }

    if (
      categoryId !== null &&
      !isValidUuid(categoryId)
    ) {
      return jsonResponse(
        { error: "Invalid category." },
        400,
      );
    }

    if (
      year !== null &&
      (year < 1900 || year > 2200)
    ) {
      return jsonResponse(
        { error: "Invalid upload year." },
        400,
      );
    }

    // -----------------------------------------------
    // 3. Create the privileged client only after
    //    authenticating the user.
    // -----------------------------------------------

    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // -----------------------------------------------
    // 4. Verify the uploader's account.
    // -----------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await serviceClient
      .from("private_profiles")
      .select("primary_role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error(
        "Upload profile lookup failed:",
        profileError,
      );

      return jsonResponse(
        { error: "Unable to verify account access." },
        500,
      );
    }

    if (
      profile.status !== "active" ||
      !ALLOWED_ROLES.has(profile.primary_role)
    ) {
      return jsonResponse(
        { error: "Your account is not authorized to upload resources." },
        403,
      );
    }

    // -----------------------------------------------
    // 5. Check whether this operation already exists.
    // -----------------------------------------------

    const uploadMetadata = {
      fileName,
      title,
      description,
      courseCode,
      college,
      department,
      semester,
      level,
      categoryId,
      fileSize,
      mimeType,
      year,
    };

    const {
      data: existingResource,
      error: existingError,
    } = await userClient
      .from("resources")
      .select(
        "id, status, file_name, title, description, course_code, college, department, semester, level, category_id, file_size, mime_type, year",
      )
      .eq("uploader_id", user.id)
      .eq("upload_operation_id", uploadOperationId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing upload lookup failed:",
        existingError,
      );

      return jsonResponse(
        { error: "Unable to verify upload status." },
        500,
      );
    }

    if (existingResource) {
      if (
        !matchesExistingUpload(
          existingResource,
          uploadMetadata,
        )
      ) {
        return jsonResponse(
          {
            error:
              "This upload operation ID has already been used with different file or metadata. Start a new upload.",
          },
          409,
        );
      }

      return jsonResponse({
        success: true,
        duplicate: true,
        resourceId: existingResource.id,
        status: existingResource.status,
      });
    }

    // -----------------------------------------------
    // 6. Validate the category and submission fields.
    // -----------------------------------------------

    let categoryName = "";

    if (categoryId) {
      const {
        data: category,
        error: categoryError,
      } = await serviceClient
        .from("categories")
        .select("name")
        .eq("id", categoryId)
        .is("deleted_at", null)
        .maybeSingle();

      if (categoryError || !category) {
        return jsonResponse(
          { error: "Selected category is unavailable." },
          400,
        );
      }

      categoryName = category.name;
    }

    const isGlobalCategory =
      GLOBAL_CATEGORIES.has(categoryName);

    const academicValidationError =
      validateAcademicSelection({
        isGlobalCategory,
        status,
        college: college || "",
        department: department || "",
      });

    if (academicValidationError) {
      return jsonResponse(
        { error: academicValidationError },
        400,
      );
    }

    if (status === "pending") {
      if (
        !title ||
        !description ||
        !categoryId ||
        !semester ||
        year === null
      ) {
        return jsonResponse(
          {
            error:
              "Complete the required fields before submitting for review.",
          },
          400,
        );
      }

      if (
        !isGlobalCategory &&
        (
          !college ||
          !department ||
          !level ||
          !courseCode
        )
      ) {
        return jsonResponse(
          {
            error:
              "Complete the academic details before submitting for review.",
          },
          400,
        );
      }
    }

    // -----------------------------------------------
    // 7. Derive the deterministic Storage path.
    // -----------------------------------------------

    const safeName = getSafeFilename(fileName);

    if (
      !safeName ||
      safeName === "." ||
      safeName === ".." ||
      safeName.length > MAX_FILENAME_LENGTH
    ) {
      return jsonResponse(
        { error: "Invalid filename." },
        400,
      );
    }

    const storedObjectName =
      `${uploadOperationId}-${safeName}`;

    const filePath =
      `${user.id}/${storedObjectName}`;

    // -----------------------------------------------
    // 8. Verify that the uploaded object exists.
    // -----------------------------------------------

    const {
      data: storedFiles,
      error: storageError,
    } = await serviceClient.storage
      .from("resources")
      .list(user.id, {
        search: storedObjectName,
        limit: 10,
      });

    if (storageError) {
      console.error(
        "Storage verification failed:",
        storageError,
      );

      return jsonResponse(
        { error: "Unable to verify uploaded file." },
        500,
      );
    }

    const storedFile = storedFiles?.find(
      (item) => item.name === storedObjectName,
    );

    if (!storedFile) {
      return jsonResponse(
        { error: "Uploaded file could not be found." },
        404,
      );
    }

    const storedSize = storedFile.metadata?.size;
    const storedMimeType = storedFile.metadata?.mimetype;

    if (
      typeof storedSize !== "number" ||
      !Number.isSafeInteger(storedSize) ||
      storedSize !== fileSize
    ) {
      return jsonResponse(
        {
          error:
            "Uploaded file size does not match the submitted file.",
        },
        400,
      );
    }

    if (
      typeof storedMimeType !== "string" ||
      storedMimeType.trim().toLowerCase() !== mimeType.toLowerCase()
    ) {
      return jsonResponse(
        {
          error:
            "Uploaded file type does not match the submitted file type.",
        },
        400,
      );
    }

    // -----------------------------------------------
    // 9. Insert through the authenticated client.
    //
    // This preserves the existing resources RLS
    // policies instead of bypassing them.
    // -----------------------------------------------

    const {
      data: createdResource,
      error: insertError,
    } = await userClient
      .from("resources")
      .insert({
        uploader_id: user.id,
        upload_operation_id: uploadOperationId,
        category_id: categoryId,
        title,
        description: description || null,
        course_code: courseCode || null,
        college: college || null,
        department: department || null,
        semester: semester || null,
        level: level || null,
        year,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        status,
        deleted_at: null,
        deleted_by: null,
      })
      .select("id, status")
      .maybeSingle();

    // -----------------------------------------------
    // 10. Handle concurrent duplicate requests.
    // -----------------------------------------------

    if (insertError) {
      if (insertError.code === "23505") {
        const {
          data: duplicateResource,
          error: duplicateError,
        } = await userClient
          .from("resources")
          .select(
            "id, status, file_name, title, description, course_code, college, department, semester, level, category_id, file_size, mime_type, year",
          )
          .eq("uploader_id", user.id)
          .eq("upload_operation_id", uploadOperationId)
          .maybeSingle();

        if (
          !duplicateError &&
          duplicateResource
        ) {
          if (
            !matchesExistingUpload(
              duplicateResource,
              uploadMetadata,
            )
          ) {
            return jsonResponse(
              {
                error:
                  "This upload operation ID has already been used with different file or metadata. Start a new upload.",
              },
              409,
            );
          }

          return jsonResponse({
            success: true,
            duplicate: true,
            resourceId: duplicateResource.id,
            status: duplicateResource.status,
          });
        }
      }

      console.error(
        "Resource creation failed:",
        insertError,
      );

      return jsonResponse(
        { error: "Unable to create resource." },
        500,
      );
    }

    if (!createdResource) {
      return jsonResponse(
        { error: "Resource could not be created." },
        500,
      );
    }

    return jsonResponse({
      success: true,
      duplicate: false,
      resourceId: createdResource.id,
      status: createdResource.status,
    });
  } catch (error) {
    console.error(
      "Finalize resource upload failed:",
      error,
    );

    return jsonResponse(
      { error: "Unable to finalize this upload." },
      500,
    );
  }
});