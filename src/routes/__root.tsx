import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-gold sm:text-sm">
          Aneks Library
        </p>

        <h1 className="mt-2 text-5xl font-semibold text-foreground sm:mt-3 sm:text-7xl">
          404
        </h1>

        <h2 className="mt-3 text-lg font-semibold sm:mt-4 sm:text-xl">
          Page not found
        </h2>

        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
          The resource you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-5 sm:mt-6">
          <Link
            to="/"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground shadow-soft transition-colors hover:opacity-90 sm:h-10 sm:text-sm"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: ErrorComponentProps) {
  const router = useRouter();

  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error);

  useEffect(() => {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(String(error));

    console.error(
      "[Aneks Library] Root route error:",
      normalizedError,
    );

    reportLovableError(normalizedError, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold sm:text-xl">
          This page didn't load
        </h1>

        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
          Something went wrong. Refresh or head back home.
        </p>

        <div className="mt-4 rounded-md border border-border bg-muted/50 p-3 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
            Diagnostic details
          </p>

          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-foreground sm:text-xs">
            {errorMessage || "No error message was provided."}
          </pre>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 sm:h-10 sm:text-sm"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-xs font-medium hover:bg-accent sm:h-10 sm:text-sm"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aneks Library | Built for Academic Excellence" },
      {
        name: "description",
        content:
          "Discover, share and download past questions, project reports, seminar papers, lecture notes, research and e-books on Aneks Library.",
      },
      {
  property: "og:title",
  content: "Aneks Library | Built for Academic Excellence",
},
{
  property: "og:description",
  content:
    "A modern academic digital repository for students, lecturers and researchers. Upload, discover and download quality resources.",
},
{
  property: "og:type",
  content: "website",
},
{
  property: "og:url",
  content: "https://anekslibrary.vercel.app",
},
{
  property: "og:image",
  content: "https://anekslibrary.vercel.app/Live.png",
},
{
  property: "og:image:width",
  content: "1200",
},
{
  property: "og:image:height",
  content: "630",
},
{
  name: "twitter:card",
  content: "summary_large_image",
},
{
  name: "twitter:image",
  content: "https://anekslibrary.vercel.app/Live.png",
},
      { name: "theme-color", content: "#064e3b" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}