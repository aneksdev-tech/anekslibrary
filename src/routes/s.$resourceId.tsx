import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";

import logo from "@/assets/Aneks_Library_Logo.png";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const SHARE_IMAGE_BASE =
  "https://riiwtxfigbwsjixwdlcq.supabase.co/functions/v1/resource-share-image";

const SITE_URL = "https://anekslibrary.vercel.app";

function getShareDescription(description: string | null) {
  const fallback =
    "Discover academic resources on Aneks Library. Read, learn and grow.";

  const normalized = description?.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 200
    ? `${normalized.slice(0, 197).trimEnd()}...`
    : normalized;
}

export const Route = createFileRoute("/s/$resourceId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.rpc(
      "get_public_resource_share_metadata",
      {
        p_resource_id: params.resourceId,
      },
    );

    if (error) {
      console.error(
        "[Aneks Library] Unable to load public share metadata:",
        error,
      );

      throw error;
    }

    const resource = data?.[0];

    if (!resource) {
      throw notFound();
    }

    return { resource };
  },

head: ({ loaderData }) => {
  if (!loaderData) {
    return {};
  }

  const { resource } = loaderData;

  const title = `${resource.title} | Aneks Library`;
  const description = getShareDescription(resource.description);
  const shareUrl = `${SITE_URL}/s/${resource.id}`;

  const shareImageUrl =
    `${SHARE_IMAGE_BASE}?resourceId=${encodeURIComponent(resource.id)}`;

  return {
    meta: [
      {
        title,
      },
      {
        name: "description",
        content: description,
      },

      // Open Graph metadata
      {
        property: "og:title",
        content: title,
      },
      {
        property: "og:description",
        content: description,
      },
      {
        property: "og:type",
        content: "article",
      },
      {
        property: "og:url",
        content: shareUrl,
      },
      {
        property: "og:site_name",
        content: "Aneks Library",
      },
      {
        property: "og:image",
        content: shareImageUrl,
      },
      {
        property: "og:image:type",
        content: "image/png",
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "1800",
      },
      {
        property: "og:image:alt",
        content: `${resource.title} - Aneks Library Academic Resource`,
      },

      // Twitter / X metadata
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: title,
      },
      {
        name: "twitter:description",
        content: description,
      },
      {
        name: "twitter:image",
        content: shareImageUrl,
      },
    ],

    links: [
      {
        rel: "canonical",
        href: shareUrl,
      },
    ],
  };
},

  component: ResourceSharePage,
});

/* -------------------------------------------------
   THEME TOGGLE
------------------------------------------------- */

function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="cursor-pointer rounded-sm border border-border bg-card p-2 text-muted-foreground shadow-soft transition-colors hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

/* -------------------------------------------------
   HEADER / NAVIGATION
------------------------------------------------- */

function Header() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  const navigation = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about" },
    { label: "Features", href: "/#features" },
    { label: "Categories", href: "/#categories" },
    { label: "How it works", href: "/#how" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contact", href: "/#contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background">
      <div className="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 sm:px-6 md:h-14 md:px-4 lg:h-16 lg:px-6">
        <Link
          to="/"
          className="flex items-center gap-0.5"
          onClick={() => setOpen(false)}
        >
          <img
            src={logo}
            alt="Aneks Library"
            className="h-10 w-10 rounded-sm object-contain md:h-8 md:w-8 lg:h-10 lg:w-10"
          />

          <span className="-ml-2 font-display text-xs font-semibold tracking-tight sm:text-lg md:text-sm lg:text-lg">
            <span className="text-gold">neks</span> Library
          </span>
        </Link>

        <nav className="hidden items-center gap-3 text-sm text-muted-foreground md:flex md:gap-2 md:text-xs lg:gap-3 lg:text-sm">
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-1.5 lg:gap-2">
          <ThemeToggle />

          {session ? (
            <Button
              asChild
              size="sm"
              className="group bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:text-sm"
            >
              <Link to="/dashboard">
                <span className="hidden transition-colors sm:inline">
                  Open Dashboard
                </span>

                <span className="transition-colors group-hover:text-primary sm:hidden">
                  Dashboard
                </span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="group bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:px-2.5 md:text-xs lg:px-3 lg:text-sm"
            >
              <Link to="/auth" search={{ mode: "register" }}>
                <span className="transition-colors">
                  Get Started
                </span>
              </Link>
            </Button>
          )}

          <button
            onClick={() => setOpen(!open)}
            className="cursor-pointer rounded-sm border border-border bg-card p-2 shadow-soft md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex flex-col gap-1">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-sm px-3 py-3 transition hover:bg-muted"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------------
   RESOURCE INFORMATION
------------------------------------------------- */

function ResourceSharePage() {
  const { resource } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header />

      <main>
        {/* RESOURCE HERO */}
        <section className="relative isolate overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]" />

          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-4 md:py-14 lg:px-6 lg:py-20">
            <div className="mx-auto max-w-4xl">
              {/* Breadcrumb */}
              <div className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Link
                  to="/"
                  className="transition-colors hover:text-foreground"
                >
                  Home
                </Link>

                <span>/</span>

                <span>Library</span>

                <span>/</span>

                <span className="text-foreground">
                  {resource.category_name || "Resource"}
                </span>
              </div>

              {/* Resource heading */}
              <div className="inline-flex items-center gap-2 rounded-sm border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
                <BookOpen className="h-3.5 w-3.5 text-gold" />

                {resource.category_name || "Academic Resource"}
              </div>

              <h1 className="mt-5 max-w-4xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                {resource.title}
              </h1>

              <div className="mt-6 h-1 w-16 rounded-full bg-gradient-emerald" />

              {/* Description */}
              <div className="mt-7 max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  About this resource
                </p>

                {resource.description?.trim() ? (
                  <p className="mt-3 whitespace-pre-line text-base leading-8 text-muted-foreground sm:text-lg">
                    {resource.description}
                  </p>
                ) : (
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    Explore this academic resource on Aneks Library.
                  </p>
                )}
              </div>

  {/* Resource action */}
  <div className="mt-9 flex flex-nowrap items-center gap-3">
  <Button
    asChild
    size="lg"
    className="w-fit shrink-0 group bg-gradient-emerald px-3 shadow-md text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:px-4 sm:text-sm"
  >
    <Link
      to="/preview/$resourceId"
      params={{ resourceId: resource.id }}
    >
      <span className="transition-colors ml-2">
        View Resource
      </span>

      <ArrowRight className="h-4 w-2 transition-colors" />
    </Link>
  </Button>

  <Button
    asChild
    size="lg"
    variant="outline"
    className="shrink-0 group bg-muted shadow-md transition-all hover:bg-none hover:bg-accent hover:shadow-md"
>
  <Link to="/library">
    <span className="transition-colors group-hover:text-muted-foreground">
      Library
    </span>
  </Link>
</Button>
</div>

              <p className="mt-5 max-w-xl text-xs leading-6 text-muted-foreground">
                Access to the resource preview is subject to Aneks Library's
                account and resource access requirements.
              </p>
            </div>
          </div>
        </section>

        {/* RESOURCE INFORMATION STRIP */}
        <section className="border-b border-border/60 bg-secondary/40">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 md:px-4 lg:px-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>

              <div>
                <p className="text-sm font-semibold">
                  Library
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Discover organized academic materials for learning and
                  research.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
                <ArrowRight className="h-5 w-5" />
              </span>

              <div>
                <p className="text-sm font-semibold">
                  Easy Access
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Continue to the resource preview through the secure platform.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>

              <div>
                <p className="text-sm font-semibold">
                  Learn and Grow
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Read, learn and grow with Aneks Library.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------
   FOOTER
------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-4 md:gap-6 md:px-4 md:py-12 lg:gap-10 lg:px-6 lg:py-14">
        {/* Brand */}
          <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-0.5">
            <img
              src={logo}
              alt="Aneks Library"
              className="h-9 w-9 rounded-sm object-contain md:h-8 md:w-8 lg:h-9 lg:w-9"
            />

            <span className="-ml-1 font-display text-lg font-semibold md:text-base lg:text-lg">
              <span className="text-gold">neks</span> Library
            </span>
          </Link>

          <p className="mt-3 text-sm text-muted-foreground md:mt-2 md:text-sm lg:mt-3 lg:text-sm">
            The official digital academic library built for Michael Okpara
            University of Agriculture, Umudike (MOUAU). Helping students
            study smarter.
          </p>
        </div>

        {/* Company */}
        <div>
          <div className="mb-3 text-sm font-medium md:mb-2 md:text-sm lg:mb-3 lg:text-sm">
            Company
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground md:space-y-1.5 md:text-sm lg:space-y-2 lg:text-sm">
            <li>
              <a href="#" className="hover:text-foreground">
                Privacy Policy
              </a>
            </li>

            <li>
              <a href="#" className="hover:text-foreground">
                Terms of Service
              </a>
            </li>

            <li>
              <a
                href="mailto:hello@anekslibrary.com"
                className="hover:text-foreground"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>

        {/* Product */}
        <div>
          <div className="mb-3 text-sm font-medium md:mb-2 md:text-sm lg:mb-3 lg:text-sm">
            Product
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground md:space-y-1.5 md:text-sm lg:space-y-2 lg:text-sm">
            <li>
              <Link to="/library" className="hover:text-foreground">
                Library
              </Link>
            </li>

            <li>
              <a href="/#about" className="hover:text-foreground">
                About
              </a>
            </li>

            <li>
              <a href="/#features" className="hover:text-foreground">
                Features
              </a>
            </li>

            <li>
              <a href="/#categories" className="hover:text-foreground">
                Categories
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className="col-span-2 md:col-span-1">
          <div className="mb-3 text-sm font-medium md:mb-2 md:text-sm lg:mb-3 lg:text-sm">
            Newsletter
          </div>

          <p className="text-sm text-muted-foreground md:text-sm lg:text-sm">
            Occasional updates on new categories and improvements.
          </p>

          <form
            className="mt-3 flex flex-col gap-2 xl:flex-row md:mt-2 lg:mt-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              required
              placeholder="you@university.edu"
              className="min-w-0 flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring md:px-2.5 md:py-1.5 md:text-sm lg:px-3 lg:py-2 lg:text-sm"
            />

            <Button
              type="submit"
              className="group w-full shrink-0 bg-gradient-emerald text-white !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:h-9 md:text-sm lg:h-9 lg:text-sm xl:w-auto"
            >
              <span className="transition-colors">
                Join
              </span>
            </Button>
          </form>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-8xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 md:px-4 md:py-5 lg:px-6 lg:py-6">
          <p>
            © {new Date().getFullYear()} Aneks Library. All rights reserved.
          </p>

          <p>Built by AneksDev Technologies.</p>
        </div>
      </div>
    </footer>
  );
}