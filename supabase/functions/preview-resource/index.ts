import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_BATCH_SIZE = 3;
const SIGNED_URL_EXPIRY = 300;

const VALID_CONTEXTS = [
  "public",
  "academic",
  "approvals",
  "resources",
] as const;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  additionalHeaders: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "private, no-store",
      ...additionalHeaders,
    },
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidRendererUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isValidPreviewPath(
  objectPath: unknown,
  resourceId: string,
  variant: string,
  expectedPageNumber: number,
) {
  if (typeof objectPath !== "string") {
    return false;
  }

  if (
    objectPath.startsWith("/") ||
    objectPath.includes("..") ||
    objectPath.includes("\\") ||
    objectPath.includes("?") ||
    objectPath.includes("#")
  ) {
    return false;
  }

  const escapedResourceId = resourceId.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const escapedVariant = variant.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pathPattern = new RegExp(
    `^${escapedResourceId}/[a-f0-9]{64}/${escapedVariant}/page-\\d{6}\\.(png|gif)$`,
    "i",
  );

  if (!pathPattern.test(objectPath)) {
    return false;
  }

  const fileName = objectPath.split("/").pop() ?? "";
  const pageMatch = fileName.match(/^page-(\d{6})\.(png|gif)$/i);

  if (!pageMatch) {
    return false;
  }

  return Number(pageMatch[1]) === expectedPageNumber;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
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
    const authorization = req.headers.get("Authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    const rendererUrl = Deno.env.get("WATERMARK_SERVER_URL");
    const watermarkSecret = Deno.env.get(
      "WATERMARK_SERVER_SECRET",
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !rendererUrl ||
      !watermarkSecret
    ) {
      console.error(
        "Preview service environment configuration is incomplete.",
      );

      return jsonResponse(
        { error: "Preview service is not configured." },
        500,
      );
    }

    if (!isValidRendererUrl(rendererUrl)) {
      console.error("Preview renderer URL is invalid.");

      return jsonResponse(
        { error: "Preview service is not configured correctly." },
        500,
      );
    }

    /*
     * Authenticate the requesting user.
     *
     * The renderer independently verifies this JWT and
     * performs the resource authorization checks.
     */
    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
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

    /*
     * Validate the request body.
     */
    let body: Record<string, unknown>;

    try {
      const parsedBody = await req.json();

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return jsonResponse(
          { error: "Invalid request body." },
          400,
        );
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return jsonResponse(
        { error: "Invalid JSON request body." },
        400,
      );
    }

    const resourceId = body.resourceId;
    const context = body.context;

    if (
      typeof resourceId !== "string" ||
      !resourceId.trim() ||
      !isValidUuid(resourceId)
    ) {
      return jsonResponse(
        { error: "Invalid or missing resourceId." },
        400,
      );
    }

    if (
      typeof context !== "string" ||
      !VALID_CONTEXTS.includes(
        context as (typeof VALID_CONTEXTS)[number],
      )
    ) {
      return jsonResponse(
        { error: "Invalid preview context." },
        400,
      );
    }

    /*
     * Progressive page delivery.
     *
     * pageFrom is zero-based.
     * Each request returns at most three pages.
     */
    const requestedPageFrom =
      body.pageFrom === undefined ? 0 : body.pageFrom;

    if (
      !Number.isInteger(requestedPageFrom) ||
      (requestedPageFrom as number) < 0
    ) {
      return jsonResponse(
        { error: "Invalid pageFrom value." },
        400,
      );
    }

    const pageFrom = requestedPageFrom as number;

    const requestedPageCount =
      body.pageCount === undefined
        ? PAGE_BATCH_SIZE
        : body.pageCount;

    if (
      !Number.isInteger(requestedPageCount) ||
      (requestedPageCount as number) < 1
    ) {
      return jsonResponse(
        { error: "Invalid pageCount value." },
        400,
      );
    }

    const pageCount = Math.min(
      requestedPageCount as number,
      PAGE_BATCH_SIZE,
    );

    /*
     * Ask the renderer to prepare the requested batch.
     *
     * The original resource URL and original file are
     * never returned to the browser.
     */
    const normalizedRendererUrl = rendererUrl.replace(
      /\/+$/,
      "",
    );

    const rendererResponse = await fetch(
      `${normalizedRendererUrl}/preview/prepare`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-watermark-secret": watermarkSecret,
        },
        body: JSON.stringify({
          resourceId,
          context,
          pageFrom,
          pageCount,
        }),
        signal: AbortSignal.timeout(180000),
      },
    );

    let rendererData: Record<string, unknown>;

    try {
      const parsedResponse = await rendererResponse.json();

      if (
        !parsedResponse ||
        typeof parsedResponse !== "object" ||
        Array.isArray(parsedResponse)
      ) {
        throw new Error("Invalid renderer response.");
      }

      rendererData = parsedResponse as Record<string, unknown>;
    } catch {
      console.error(
        "Preview renderer returned an unreadable response:",
        rendererResponse.status,
      );

      return jsonResponse(
        { error: "Unable to read the preview renderer response." },
        502,
      );
    }

    /*
     * The renderer uses HTTP 202 while the requested
     * pages are still being prepared.
     *
     * Do not treat this as an error and do not attempt
     * to sign URLs until pages are actually ready.
     */
    if (rendererResponse.status === 202) {
      const suppliedRetryAfter = rendererData.retryAfterMs;

      const retryAfterMs =
        Number.isInteger(suppliedRetryAfter) &&
        (suppliedRetryAfter as number) >= 250
          ? Math.min(suppliedRetryAfter as number, 5000)
          : 1000;

      return jsonResponse(
        {
          resourceId,
          pageFrom,
          status: "processing",
          retryAfterMs,
          error:
            "The requested preview pages are still being prepared.",
        },
        202,
        {
          "Retry-After": String(
            Math.max(1, Math.ceil(retryAfterMs / 1000)),
          ),
        },
      );
    }

    /*
     * Handle renderer errors.
     */
    if (!rendererResponse.ok) {
      console.error(
        "Preview renderer rejected request:",
        rendererResponse.status,
        rendererData.error,
      );

      const status =
        rendererResponse.status >= 400 &&
        rendererResponse.status < 500
          ? rendererResponse.status
          : 502;

      const safeError =
        status === 502
          ? "Unable to prepare this preview."
          : typeof rendererData.error === "string"
            ? rendererData.error
            : "Unable to prepare this preview.";

      return jsonResponse(
        { error: safeError },
        status,
      );
    }

    /*
     * Validate the renderer's progressive response.
     *
     * A successful response may contain fewer than
     * three pages when fewer pages remain in the resource.
     */
    const rendererPageCount = rendererData.pageCount;
    const rendererPageFrom = rendererData.pageFrom;
    const variant = rendererData.variant;
    const allPages = rendererData.pages;
    const renderingStatus = rendererData.renderingStatus;

    if (
      !Number.isInteger(rendererPageCount) ||
      (rendererPageCount as number) < 1 ||
      !Number.isInteger(rendererPageFrom) ||
      rendererPageFrom !== pageFrom ||
      (variant !== "full" && variant !== "restricted") ||
      !Array.isArray(allPages) ||
      allPages.length < 1 ||
      allPages.length > pageCount ||
      pageFrom + allPages.length > (rendererPageCount as number) ||
      (renderingStatus !== "rendering" &&
        renderingStatus !== "completed" &&
        renderingStatus !== "failed")
    ) {
      console.error(
        "Renderer returned an invalid progressive preview response.",
      );

      return jsonResponse(
        {
          error:
            "The preview renderer returned invalid page data.",
        },
        502,
      );
    }

    /*
     * Validate pagination metadata.
     */
    const nextPageFrom = pageFrom + allPages.length;
    const hasMore = nextPageFrom < (rendererPageCount as number);

    if (
      rendererData.hasMore !== hasMore ||
      rendererData.nextPageFrom !==
        (hasMore ? nextPageFrom : null)
    ) {
      console.error(
        "Renderer returned inconsistent preview pagination metadata.",
      );

      return jsonResponse(
        {
          error:
            "The preview renderer returned invalid pagination data.",
        },
        502,
      );
    }

    /*
     * Sign only the requested derivative pages.
     *
     * Validate every path before signing any URL.
     * Paths must belong to this resource, its expected
     * cache version and variant, and the requested page range.
     */
    const selectedPages = allPages as unknown[];

    for (let index = 0; index < selectedPages.length; index++) {
      const expectedPageNumber = pageFrom + index + 1;

      if (
        !isValidPreviewPath(
          selectedPages[index],
          resourceId,
          variant,
          expectedPageNumber,
        )
      ) {
        console.error(
          "Renderer returned an invalid preview storage path.",
        );

        return jsonResponse(
          {
            error:
              "The preview renderer returned invalid page data.",
          },
          502,
        );
      }
    }

    /*
     * Use the service role only for signing objects
     * in the private resource-previews bucket.
     */
    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const signedPages: Array<{
      pageNumber: number;
      url: string;
    }> = [];

    for (
      let index = 0;
      index < selectedPages.length;
      index++
    ) {
      const objectPath = selectedPages[index] as string;

      const {
        data: signedData,
        error: signedUrlError,
      } = await serviceClient.storage
        .from("resource-previews")
        .createSignedUrl(
          objectPath,
          SIGNED_URL_EXPIRY,
        );

      if (
        signedUrlError ||
        !signedData?.signedUrl
      ) {
        console.error(
          "Unable to sign preview page:",
          signedUrlError,
        );

        return jsonResponse(
          {
            error:
              "Unable to create protected page access.",
          },
          500,
        );
      }

      signedPages.push({
        pageNumber: pageFrom + index + 1,
        url: signedData.signedUrl,
      });
    }

    /*
     * Return the ready pages and pagination information.
     *
     * The client can request the next batch using
     * nextPageFrom while hasMore is true.
     */
    return jsonResponse({
      resourceId,
      pageCount: rendererPageCount,
      pageFrom,
      variant,
      pages: signedPages,
      nextPageFrom: hasMore ? nextPageFrom : null,
      hasMore,
      renderingStatus,
    });
  } catch (error) {
    console.error(
      "Preview resource function failed:",
      error,
    );

    if (
      error instanceof DOMException &&
      error.name === "TimeoutError"
    ) {
      return jsonResponse(
        {
          error:
            "The preview service took too long to respond. Please retry.",
        },
        504,
      );
    }

    return jsonResponse(
      {
        error: "Unable to load this preview.",
      },
      500,
    );
  }
});