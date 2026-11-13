import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { FileText, LoaderCircle, RefreshCw } from "lucide-react";
import { PreviewRestrictionOverlay } from "./PreviewRestrictionOverlay";

type PreviewContext =
  | "public"
  | "academic"
  | "approvals"
  | "resources";

type PreviewVariant = "full" | "free";

interface PreviewPage {
  pageNumber: number;
  url: string;
}

interface PreviewResponse {
  resourceId: string;
  pageCount: number;
  renderedPageCount: number;
  pageFrom: number;
  variant: PreviewVariant;
  pages: PreviewPage[];
  nextPageFrom: number | null;
  hasMore: boolean;
  upgradeRequired: boolean;
  upgradePage: number | null;
  renderingStatus: "rendering" | "completed" | "failed";
}

interface ProcessingResponse {
  error?: string;
  status?: "processing";
  retryAfterMs?: number;
}

interface DocumentPreviewProps {
  url: string;
  token: string;
  resourceId: string;
  context: PreviewContext;
  filePath: string;
  title?: string;
  scrollRoot?: HTMLDivElement | null;

  /**
   * Retained temporarily for compatibility with existing callers.
   * The server now determines the actual preview restriction.
   */
  restrictPreview?: boolean;

  onUpgradeClick?: () => void;
}

const PAGE_BATCH_SIZE = 3;
const FREE_PREVIEW_PAGE_LIMIT = 3;
const MAX_PREPARATION_TIME_MS = 5 * 60 * 1000;
const MAX_AUTOMATIC_IMAGE_REFRESHES = 2;

function getFileExtension(filePath: string) {
  return filePath
    .split(".")
    .pop()
    ?.toLowerCase();
}

function waitForRetry(
  delay: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(
        new DOMException(
          "Preview request was cancelled.",
          "AbortError",
        ),
      );
      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener(
        "abort",
        handleAbort,
      );

      resolve();
    }, delay);

    function handleAbort() {
      window.clearTimeout(timeout);

      signal.removeEventListener(
        "abort",
        handleAbort,
      );

      reject(
        new DOMException(
          "Preview request was cancelled.",
          "AbortError",
        ),
      );
    }

    signal.addEventListener(
      "abort",
      handleAbort,
      { once: true },
    );
  });
}

/**
 * Requests one batch of server-processed preview pages.
 *
 * HTTP 202 means rendering is still in progress.
 * In that case, the request is retried after the
 * server-specified delay.
 */
async function requestPreviewBatch({
  url,
  token,
  resourceId,
  context,
  pageFrom,
  signal,
}: {
  url: string;
  token: string;
  resourceId: string;
  context: PreviewContext;
  pageFrom: number;
  signal: AbortSignal;
}): Promise<PreviewResponse> {
  const preparationDeadline =
    Date.now() + MAX_PREPARATION_TIME_MS;

  while (Date.now() < preparationDeadline) {
    if (signal.aborted) {
      throw new DOMException(
        "Preview request was cancelled.",
        "AbortError",
      );
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey:
          import.meta.env
            .VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId,
        context,
        pageFrom,
        pageCount: PAGE_BATCH_SIZE,
      }),
      signal,
    });

    const data = await response
      .json()
      .catch(() => null);

    /**
     * The renderer has not completed the requested batch.
     * Wait and retry instead of treating HTTP 202 as an error.
     */
    if (response.status === 202) {
      const processingData =
        data as ProcessingResponse | null;

      const retryAfterMs = Math.min(
        Math.max(
          processingData?.retryAfterMs ?? 1000,
          500,
        ),
        5000,
      );

      await waitForRetry(
        retryAfterMs,
        signal,
      );

      continue;
    }

    if (!response.ok) {
      throw new Error(
        data?.error ??
          "Unable to prepare the document preview.",
      );
    }

    if (
      !data ||
      data.resourceId !== resourceId ||
      data.pageFrom !== pageFrom ||
      !Number.isSafeInteger(data.pageCount) ||
      data.pageCount < 1 ||
      !Number.isSafeInteger(data.renderedPageCount) ||
      data.renderedPageCount < 0 ||
      data.renderedPageCount > data.pageCount ||
      pageFrom > data.pageCount ||
      !["full", "free"].includes(data.variant) ||
      !Array.isArray(data.pages) ||
      data.pages.length > PAGE_BATCH_SIZE ||
      typeof data.hasMore !== "boolean" ||
      !(
        data.nextPageFrom === null ||
        Number.isSafeInteger(data.nextPageFrom)
      ) ||
      typeof data.upgradeRequired !== "boolean" ||
      !(
        data.upgradePage === null ||
        Number.isSafeInteger(data.upgradePage)
      ) ||
      ![
        "rendering",
        "completed",
        "failed",
      ].includes(data.renderingStatus)
    ) {
      throw new Error(
        "The preview server returned an invalid response.",
      );
    }

    const isFreeVariant =
      data.variant === "free";

    /**
     * Validate the server's Free preview page limit.
     */
    if (
      isFreeVariant &&
      (
        data.renderedPageCount >
          FREE_PREVIEW_PAGE_LIMIT ||
        (
          data.pageCount <= FREE_PREVIEW_PAGE_LIMIT &&
          data.renderedPageCount !== data.pageCount
        ) ||
        (
          data.pageCount > FREE_PREVIEW_PAGE_LIMIT &&
          data.renderedPageCount !== FREE_PREVIEW_PAGE_LIMIT
        )
      )
    ) {
      throw new Error(
        "The preview server returned inconsistent Free preview limits.",
      );
    }

    /**
     * A full variant must expose the complete document.
     */
    if (
      !isFreeVariant &&
      data.renderedPageCount !== data.pageCount
    ) {
      throw new Error(
        "The preview server returned inconsistent full-preview metadata.",
      );
    }

    /**
     * Handle the dedicated Premium upgrade response.
     * No page URLs are accepted in this response.
     */
    if (data.upgradeRequired) {
      if (
        !isFreeVariant ||
        data.pageCount <= FREE_PREVIEW_PAGE_LIMIT ||
        data.renderedPageCount !== FREE_PREVIEW_PAGE_LIMIT ||
        data.upgradePage !== FREE_PREVIEW_PAGE_LIMIT + 1 ||
        pageFrom < FREE_PREVIEW_PAGE_LIMIT ||
        pageFrom >= data.pageCount ||
        data.pages.length !== 0 ||
        data.hasMore ||
        data.nextPageFrom !== null
      ) {
        throw new Error(
          "The preview server returned invalid upgrade metadata.",
        );
      }

      return data as PreviewResponse;
    }

    if (data.upgradePage !== null) {
      throw new Error(
        "The preview server returned unexpected upgrade metadata.",
      );
    }

    /**
     * Ordinary page responses must contain actual pages.
     */
    if (
      pageFrom >= data.renderedPageCount ||
      data.pages.length === 0 ||
      data.pages.length >
        data.renderedPageCount - pageFrom
    ) {
      throw new Error(
        "The preview server returned an invalid page range.",
      );
    }

    /**
     * Free users must never receive page 4 or later.
     */
    if (
      isFreeVariant &&
      data.pageCount > FREE_PREVIEW_PAGE_LIMIT &&
      pageFrom + data.pages.length >
        FREE_PREVIEW_PAGE_LIMIT
    ) {
      throw new Error(
        "The preview server returned pages beyond the Free preview limit.",
      );
    }

    const expectedHasMore =
      pageFrom + data.pages.length <
      data.renderedPageCount;

    const expectedNextPageFrom =
      expectedHasMore
        ? pageFrom + data.pages.length
        : null;

    if (
      data.hasMore !== expectedHasMore ||
      data.nextPageFrom !== expectedNextPageFrom
    ) {
      throw new Error(
        "The preview server returned inconsistent pagination metadata.",
      );
    }

    const pages: PreviewPage[] = data.pages;

    const validPages = pages.every(
      (page, index) =>
        Number.isSafeInteger(page.pageNumber) &&
        page.pageNumber === pageFrom + index + 1 &&
        typeof page.url === "string" &&
        page.url.startsWith("https://"),
    );

    if (!validPages) {
      throw new Error(
        "The preview server returned invalid page data.",
      );
    }

    return data as PreviewResponse;
  }

  throw new Error(
    "Preview preparation is taking longer than expected. Please try again.",
  );
}

export function DocumentPreview({
  url,
  token,
  resourceId,
  context,
  filePath,
  title,
  scrollRoot = null,
  onUpgradeClick,
}: DocumentPreviewProps) {
  const [pages, setPages] = useState<PreviewPage[]>([]);

  const [pageCount, setPageCount] = useState(0);

   const [variant, setVariant] =
    useState<PreviewVariant | null>(null);

  const [upgradeRequired, setUpgradeRequired] =
    useState(false);

  const [nextPageFrom, setNextPageFrom] =
    useState<number | null>(null);

  const [hasMore, setHasMore] = useState(false);

  const [loadingInitial, setLoadingInitial] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  const [loadMoreError, setLoadMoreError] =
    useState("");

  const [retryInitial, setRetryInitial] =
    useState(0);

  const [imageErrors, setImageErrors] =
    useState<Set<number>>(new Set());

  const loaderRef = useRef<HTMLDivElement>(null);

  const loadingMoreRef = useRef(false);

  const controllersRef = useRef(
    new Set<AbortController>(),
  );

  const imageRefreshAttemptsRef = useRef(
    new Map<number, number>(),
  );

  const refreshingBatchesRef = useRef(
    new Map<number, Promise<void>>(),
  );

  const extension = getFileExtension(filePath);

  const isSupportedFile = [
    "pdf",
    "docx",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
  ].includes(extension ?? "");

  /**
   * Cancel outstanding requests when this component
   * is unmounted.
   */
  useEffect(() => {
    return () => {
      controllersRef.current.forEach(
        (controller) => controller.abort(),
      );

      controllersRef.current.clear();
      refreshingBatchesRef.current.clear();
    };
  }, []);

  /**
   * Load the first batch of processed pages.
   *
   * The browser never downloads the original resource.
   * It receives only signed URLs for processed page images.
   */
  useEffect(() => {
    if (!isSupportedFile) {
      setLoadingInitial(false);
      return;
    }

    const controller = new AbortController();

    controllersRef.current.add(controller);

    async function loadInitialPages() {
      setLoadingInitial(true);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setPreviewError("");
      setLoadMoreError("");
      setImageErrors(new Set());

      imageRefreshAttemptsRef.current.clear();

      setPages([]);
      setPageCount(0);
      setVariant(null);
      setUpgradeRequired(false);
      setNextPageFrom(null);
      setHasMore(false);

      try {
        const result = await requestPreviewBatch({
          url,
          token,
          resourceId,
          context,
          pageFrom: 0,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (result.upgradeRequired) {
          setUpgradeRequired(true);
          setPageCount(result.pageCount);
          setVariant(result.variant);
          return;
        }

        setPages(result.pages);
        setPageCount(result.pageCount);
        setVariant(result.variant);
        setUpgradeRequired(result.upgradeRequired);
        setNextPageFrom(result.nextPageFrom);
        setHasMore(result.hasMore);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(
          "Document preview failed:",
          error,
        );

        setPreviewError(
          error instanceof Error
            ? error.message
            : "We couldn't load this file preview. Please try again later.",
        );
      } finally {
        controllersRef.current.delete(controller);

        if (!controller.signal.aborted) {
          setLoadingInitial(false);
        }
      }
    }

    loadInitialPages();

return () => {
  controllersRef.current.forEach(
    (activeController) => activeController.abort(),
  );

  controllersRef.current.clear();

  loadingMoreRef.current = false;

  refreshingBatchesRef.current.clear();
};
  }, [
    url,
    token,
    resourceId,
    context,
    filePath,
    retryInitial,
    isSupportedFile,
  ]);

  /**
   * Request the next batch when the user approaches
   * the bottom of the currently displayed pages.
   */
  const loadMorePages = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      loadingMore ||
      !hasMore ||
      nextPageFrom === null ||
      !variant
    ) {
      return;
    }

    loadingMoreRef.current = true;

    const controller = new AbortController();

    controllersRef.current.add(controller);

    setLoadingMore(true);
    setLoadMoreError("");

    try {
      const result = await requestPreviewBatch({
        url,
        token,
        resourceId,
        context,
        pageFrom: nextPageFrom,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (result.upgradeRequired) {
        setUpgradeRequired(true);
        setHasMore(false);
        setNextPageFrom(null);
        return;
      }

      setPages((previousPages) => {
        const existingPageNumbers = new Set(
          previousPages.map(
            (page) => page.pageNumber,
          ),
        );

        const newPages = result.pages.filter(
          (page) =>
            !existingPageNumbers.has(page.pageNumber),
        );

        return [
          ...previousPages,
          ...newPages,
        ].sort(
          (a, b) =>
            a.pageNumber - b.pageNumber,
        );
      });

      setPageCount(result.pageCount);
      setVariant(result.variant);
      setUpgradeRequired(result.upgradeRequired);
      setNextPageFrom(result.nextPageFrom);
      setHasMore(result.hasMore);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error(
        "Additional preview pages failed:",
        error,
      );

      setLoadMoreError(
        error instanceof Error
          ? error.message
          : "Unable to load additional pages.",
      );
} finally {
  controllersRef.current.delete(controller);

  if (!controller.signal.aborted) {
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }
}
  }, [
    url,
    token,
    resourceId,
    context,
    nextPageFrom,
    hasMore,
    variant,
    loadingMore,
  ]);

  /**
   * Refresh signed URLs for a batch when an image
   * request fails.
   *
   * This is useful when a signed URL has expired.
   * It also allows recovery from temporary image
   * request failures.
   */
  const refreshPageBatch = useCallback(
    async (pageNumber: number) => {
      const pageFrom =
        Math.floor(
          (pageNumber - 1) / PAGE_BATCH_SIZE,
        ) * PAGE_BATCH_SIZE;

      const existingRefresh =
        refreshingBatchesRef.current.get(pageFrom);

      if (existingRefresh) {
        await existingRefresh;
        return;
      }

      const attempts =
        imageRefreshAttemptsRef.current.get(pageNumber) ?? 0;

      if (attempts >= MAX_AUTOMATIC_IMAGE_REFRESHES) {
        setImageErrors((previous) => {
          const updated = new Set(previous);
          updated.add(pageNumber);
          return updated;
        });

        return;
      }

      imageRefreshAttemptsRef.current.set(
        pageNumber,
        attempts + 1,
      );

      const controller = new AbortController();

      controllersRef.current.add(controller);

let refreshPromise!: Promise<void>;

refreshPromise = (async () => {
  try {
    const result = await requestPreviewBatch({
      url,
      token,
      resourceId,
      context,
      pageFrom,
      signal: controller.signal,
    });

    if (
      controller.signal.aborted ||
      result.upgradeRequired
    ) {
      throw new Error(
        "Unable to refresh this preview page.",
      );
    }

    setPages((previousPages) =>
      previousPages.map((existingPage) => {
        const refreshedPage = result.pages.find(
          (page) =>
            page.pageNumber === existingPage.pageNumber,
        );

        return refreshedPage
          ? refreshedPage
          : existingPage;
      }),
    );

    setImageErrors((previous) => {
      const updated = new Set(previous);

      result.pages.forEach((page) => {
        updated.delete(page.pageNumber);
      });

      return updated;
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    console.error(
      `Unable to refresh preview page ${pageNumber}:`,
      error,
    );

    setImageErrors((previous) => {
      const updated = new Set(previous);
      updated.add(pageNumber);
      return updated;
    });
  } finally {
    controllersRef.current.delete(controller);

    if (
      refreshingBatchesRef.current.get(pageFrom) ===
      refreshPromise
    ) {
      refreshingBatchesRef.current.delete(pageFrom);
    }
  }
})();

refreshingBatchesRef.current.set(
  pageFrom,
  refreshPromise,
);

await refreshPromise;
    },
    [
      url,
      token,
      resourceId,
      context,
    ],
  );

  /**
   * Manually retry a page whose automatic URL
   * refresh attempts have been exhausted.
   */
  const retryImagePage = useCallback(
    async (pageNumber: number) => {
      imageRefreshAttemptsRef.current.delete(pageNumber);

      setImageErrors((previous) => {
        const updated = new Set(previous);
        updated.delete(pageNumber);
        return updated;
      });

      await refreshPageBatch(pageNumber);
    },
    [refreshPageBatch],
  );

  /**
   * Infinite scrolling.
   *
   * The supplied scrollRoot supports both the dedicated
   * preview page and the existing modal preview layouts.
   */
  useEffect(() => {
    if (
      !loaderRef.current ||
      !hasMore ||
      loadingInitial ||
      loadingMore ||
      loadMoreError ||
      pages.length === 0
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMorePages();
        }
      },
      {
        root: scrollRoot,
        rootMargin: "600px 0px",
      },
    );

    observer.observe(loaderRef.current);

    return () => {
      observer.disconnect();
    };
  }, [
    scrollRoot,
    pages.length,
    hasMore,
    loadingInitial,
    loadingMore,
    loadMoreError,
    loadMorePages,
  ]);

  const disableContextMenu = (
    event: MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
  };

  /**
   * The first three pages are fully displayed.
   * For a long Free preview, the upgrade screen
   * appears after page 3 instead of exposing page 4.
   */
const showUpgradeScreen =
  upgradeRequired ||
  (
    variant === "free" &&
    pageCount > FREE_PREVIEW_PAGE_LIMIT &&
    pages.some(
      (page) =>
        page.pageNumber === FREE_PREVIEW_PAGE_LIMIT,
    )
  );

  if (!isSupportedFile) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-12 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>

        <h3 className="mt-4 text-lg font-semibold">
          Preview not available
        </h3>

        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This file type is not yet supported for in-browser preview.
          Downloading requires the appropriate access permission.
        </p>
      </div>
    );
  }

  if (loadingInitial) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />

        <p className="text-sm text-muted-foreground">
          Preparing document preview...
        </p>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="flex h-[70vh] items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-lg font-semibold">
            Unable to load preview
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            {previewError}
          </p>

          <button
            type="button"
            onClick={() =>
              setRetryInitial((previous) => previous + 1)
            }
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onContextMenu={disableContextMenu}
      className="relative w-full select-none space-y-4"
    >
      {pages.map((page) => (
        <div
          key={`${resourceId}-${page.pageNumber}`}
          className="relative mx-auto w-full overflow-hidden"
        >
          {imageErrors.has(page.pageNumber) ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />

              <p className="text-sm text-muted-foreground">
                Unable to load page {page.pageNumber}.
              </p>

              <button
                type="button"
                onClick={() =>
                  void retryImagePage(page.pageNumber)
                }
                className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                Retry page
              </button>
            </div>
          ) : (
            <img
              src={page.url}
              alt={
                title
                  ? `${title} — page ${page.pageNumber}`
                  : `Document page ${page.pageNumber}`
              }
              draggable={false}
              loading={
                page.pageNumber <= PAGE_BATCH_SIZE
                  ? "eager"
                  : "lazy"
              }
              onError={() =>
                void refreshPageBatch(page.pageNumber)
              }
              className="block h-auto w-full"
            />
          )}
        </div>
      ))}

      {showUpgradeScreen && (
        <div
          className="relative mx-auto flex min-h-[420px] w-full items-center justify-center overflow-hidden"
        >
          <PreviewRestrictionOverlay
            onUpgradeClick={onUpgradeClick}
          />
        </div>
      )}

      {hasMore && (
        <div
          ref={loaderRef}
          className="flex min-h-16 items-center justify-center"
          aria-live="polite"
        >
          {loadingMore && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading more pages...
            </div>
          )}

          {loadMoreError && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                {loadMoreError}
              </p>

              <button
                type="button"
                onClick={() => void loadMorePages()}
                className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                Retry loading pages
              </button>
            </div>
          )}
        </div>
      )}

      {!hasMore && !showUpgradeScreen && pageCount > 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          End of document · {pageCount}{" "}
          {pageCount === 1 ? "page" : "pages"}
        </p>
      )}
    </div>
  );
}