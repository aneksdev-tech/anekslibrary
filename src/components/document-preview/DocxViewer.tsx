import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

interface DocxViewerProps {
  blob: Blob;
  restrictPreview?: boolean;
  onUpgradeClick?: () => void;
}

const WATERMARK_ASSET =
  "/watermark-assets/aneks-watermark.png";

const WATERMARK_OPACITY = 0.4;
const WATERMARK_ROTATION = "-55deg";
const WATERMARK_SCALE = 1.5;

export function DocxViewer({
  blob,
  restrictPreview = false,
  onUpgradeClick,
}: DocxViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  const resizeObserver =
    useRef<ResizeObserver | null>(null);

  const upgradeClickRef = useRef(onUpgradeClick);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    upgradeClickRef.current = onUpgradeClick;
  }, [onUpgradeClick]);

  const updateWatermarkSizes = () => {
    if (!documentRef.current) return;

    const pages =
      documentRef.current.querySelectorAll(
        "section.docx-preview",
      );

    pages.forEach((page) => {
      const pageElement = page as HTMLElement;

      const watermark =
        pageElement.querySelector(
          ".aneks-watermark",
        ) as HTMLDivElement | null;

      const image = watermark?.querySelector("img");

      if (!watermark || !image) return;

      const width = pageElement.clientWidth;
      const height = pageElement.clientHeight;

      if (!width || !height) return;

      image.style.width = `${
        Math.round(
          Math.min(width, height) * WATERMARK_SCALE,
        )
      }px`;
    });
  };

  const applyScale = () => {
    if (!wrapperRef.current || !documentRef.current) {
      return;
    }

    const firstPage =
      documentRef.current.querySelector(
        "section.docx-preview",
      ) as HTMLElement | null;

    if (!firstPage) return;

    const wrapperWidth =
      wrapperRef.current.clientWidth;

    const pageWidth = firstPage.offsetWidth;

    if (!pageWidth) return;

    const scale = Math.min(
      1,
      wrapperWidth / pageWidth,
    );

    documentRef.current.style.transform =
      `scale(${scale})`;

    documentRef.current.style.transformOrigin =
      "top center";

    documentRef.current.style.width =
      `${pageWidth}px`;

    documentRef.current.style.margin =
      "0 auto";

    const originalHeight =
      documentRef.current.scrollHeight;

    documentRef.current.style.height =
      `${originalHeight * scale}px`;

    updateWatermarkSizes();
  };

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;

    async function renderDocument() {
      if (!documentRef.current) {
        animationFrame =
          requestAnimationFrame(renderDocument);
        return;
      }

      setLoading(true);
      setError("");

      resizeObserver.current?.disconnect();

      documentRef.current.innerHTML = "";
      documentRef.current.style.transform = "";
      documentRef.current.style.transformOrigin = "";
      documentRef.current.style.width = "";
      documentRef.current.style.height = "";
      documentRef.current.style.margin = "";

      try {
        await renderAsync(
          blob,
          documentRef.current,
          undefined,
          {
            className: "docx-preview",
            inWrapper: true,
            breakPages: true,
          },
        );

        if (cancelled || !documentRef.current) {
          return;
        }

        const pages =
          documentRef.current.querySelectorAll(
            "section.docx-preview",
          );

        pages.forEach((page) => {
          const pageElement = page as HTMLElement;

          pageElement.style.position = "relative";

          pageElement
            .querySelector(".aneks-watermark")
            ?.remove();

          pageElement
            .querySelector(".aneks-preview-restriction")
            ?.remove();

          // Watermark
          const watermark =
            document.createElement("div");

          watermark.className = "aneks-watermark";

          Object.assign(watermark.style, {
            position: "absolute",
            inset: "0",
            overflow: "hidden",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: "999",
          });

          const image =
            document.createElement("img");

          image.src = WATERMARK_ASSET;
          image.alt = "";
          image.draggable = false;

          Object.assign(image.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "0",
            height: "auto",
            maxWidth: "none",
            opacity: String(WATERMARK_OPACITY),
            transform:
              `translate(-50%, -50%) rotate(${WATERMARK_ROTATION})`,
          });

          watermark.appendChild(image);
          pageElement.appendChild(watermark);

          if (!restrictPreview) return;

          // Restriction overlay: ordinary DOM, no nested React root.
          const overlay =
            document.createElement("div");

          overlay.className =
            "aneks-preview-restriction";

          Object.assign(overlay.style, {
            position: "absolute",
            inset: "0",
            zIndex: "1000",
            overflow: "hidden",
            pointerEvents: "none",
          });

          // Frosted-glass cover.
          const glass =
            document.createElement("div");

          Object.assign(glass.style, {
            position: "absolute",
            top: "0",
            right: "0",
            bottom: "0",
            width: "50%",
            boxSizing: "border-box",
            borderLeft:
              "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
            background:
              "color-mix(in srgb, var(--background) 75%, transparent)",
            boxShadow:
              "-8px 0 24px rgba(0, 0, 0, 0.04)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            pointerEvents: "none",
          });

          overlay.appendChild(glass);

          // Centered Premium prompt.
          const prompt =
            document.createElement("div");

          Object.assign(prompt.style, {
            position: "absolute",
            top: "50%",
            right: "8px",
            width: "46%",
            transform: "translateY(-50%)",
            boxSizing: "border-box",
            padding: "8px",
            textAlign: "center",
            color: "var(--foreground)",
            fontFamily: "inherit",
            pointerEvents: "auto",
          });

        const lock =
            document.createElement("div");

          lock.setAttribute("aria-hidden", "true");

          Object.assign(lock.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            margin: "0 auto",
            color: "var(--gold)",
          });

          lock.innerHTML = `
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect
                width="18"
                height="11"
                x="3"
                y="11"
                rx="2"
              />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
          `;

          prompt.appendChild(lock);

          const heading =
            document.createElement("p");

          heading.textContent = "Premium Preview";

          Object.assign(heading.style, {
            margin: "6px 0 0",
            fontSize: "10px",
            fontWeight: "600",
            lineHeight: "1.3",
            textAlign: "center",
            color: "var(--foreground)",
          });

          prompt.appendChild(heading);

          const description =
            document.createElement("p");

          description.textContent =
            "Upgrade to read the full document.";

          Object.assign(description.style, {
            margin: "6px 0 0",
            fontSize: "10px",
            lineHeight: "1.5",
            textAlign: "center",
            color: "var(--muted-foreground)",
          });

          prompt.appendChild(description);

          if (upgradeClickRef.current) {
            const button =
              document.createElement("button");

            button.type = "button";
            button.textContent = "Upgrade";

            Object.assign(button.style, {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "28px",
              marginTop: "8px",
              padding: "4px 8px",
              border: "0",
              borderRadius: "3px",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              fontFamily: "inherit",
              fontSize: "10px",
              fontWeight: "500",
              cursor: "pointer",
            });

            const handleUpgrade = () => {
              upgradeClickRef.current?.();
            };

            button.addEventListener(
              "click",
              handleUpgrade,
            );

            overlay.addEventListener(
              "DOMNodeRemoved",
              () => {
                button.removeEventListener(
                  "click",
                  handleUpgrade,
                );
              },
              { once: true },
            );

            prompt.appendChild(button);
          }

          overlay.appendChild(prompt);
          pageElement.appendChild(overlay);
        });

        applyScale();

        resizeObserver.current?.disconnect();

        resizeObserver.current = new ResizeObserver(() => {
          applyScale();
        });

        if (wrapperRef.current) {
          resizeObserver.current.observe(
            wrapperRef.current,
          );
        }
      } catch (err) {
        console.error(
          "DOCX preview rendering failed:",
          err,
        );

        if (!cancelled) {
          setError(
            "Unable to preview this Word document. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderDocument();

    window.addEventListener("resize", applyScale);

    return () => {
      cancelled = true;

      cancelAnimationFrame(animationFrame);

      resizeObserver.current?.disconnect();

      window.removeEventListener(
        "resize",
        applyScale,
      );
    };
  }, [blob, restrictPreview]);

  return (
    <div className="relative w-full">
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/90">
          <span className="text-sm font-medium">
            Loading Word document...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-background/90 text-center">
          <p className="font-semibold text-destructive">
            Failed to load Word document.
          </p>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      )}

      {/* Viewer */}
      <div
        ref={wrapperRef}
        className="
          w-full
          overflow-hidden
          rounded-2xl
          border
          bg-muted/20
          p-4
        "
      >
        <div className="flex items-start justify-center">
          <div ref={documentRef} />
        </div>
      </div>
    </div>
  );
}