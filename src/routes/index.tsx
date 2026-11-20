import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  FileQuestion,
  FlaskConical,
  FolderKanban,
  NotebookPen,
  Presentation,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Bookmark,
  BarChart3,
  UserCog,
  Mail,
  MessageCircle,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";

import { useState } from "react";
import heroImg from "@/assets/hero6.jpg";
import logo from "@/assets/Aneks_Library_Logo.png";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aneks Library | Built for Academic Excellence" },
      {
        name: "description",
        content:
          "A premium academic repository for students, lecturers and researchers. Upload past questions, projects, seminar papers, notes and research.",
      },
      {
        property: "og:title",
        content: "Aneks Library | Access Academic Resources Instantly",
      },
      {
        property: "og:description",
        content: "Built for Academic Excellence",
      },
    ],
  }),
  component: LandingPage,
});

const stats = [
  { label: "Resources", value: "12k+" },
  { label: "Departments", value: "40+" },
  { label: "Downloads", value: "250k+" },
  { label: "Active Users", value: "2k+" },
];

const features = [
  {
    icon: Upload,
    title: "Upload Resources",
    desc: "Contribute past questions, notes, projects and more in seconds.",
  },
  {
    icon: Search,
    title: "Fast Search",
    desc: "Instant, filterable search across every category and department.",
  },
  {
    icon: Download,
    title: "Unlimited Premium Downloads",
    desc: "Free users preview resources while Premium members enjoy unlimited secure downloads.",
  },
  {
    icon: ShieldCheck,
    title: "Verified Accounts",
    desc: "Email verification, role-aware sessions and row-level security.",
  },
  {
    icon: UserCog,
    title: "Role-Based Access",
    desc: "Distinct experiences for students, lecturers, researchers and admins.",
  },
  {
    icon: Shield,
    title: "Admin Moderation",
    desc: "Every upload is reviewed before it goes public. Quality guaranteed.",
  },
  {
    icon: BarChart3,
    title: "Learning Insights",
    desc: "Track uploads, downloads and community engagement over time.",
  },
  {
    icon: Bookmark,
    title: "Bookmarks",
    desc: "Save the resources you love and sync them across all your devices.",
  },
];

const categories = [
  {
    icon: FileQuestion,
    name: "Past Questions",
    desc: "Previous exam & test papers",
    slug: "past-questions",
  },
  {
    icon: FolderKanban,
    name: "Projects",
    desc: "Final-year & semester projects",
    slug: "projects",
  },
  {
    icon: Presentation,
    name: "Seminars",
    desc: "Seminar papers & slide decks",
    slug: "seminars",
  },
  {
    icon: ClipboardList,
    name: "Assignments",
    desc: "Coursework & solutions",
    slug: "assignments",
  },
  {
    icon: NotebookPen,
    name: "Lecture Notes",
    desc: "Course notes & summaries",
    slug: "lecture-notes",
  },
  {
    icon: FlaskConical,
    name: "Research Papers",
    desc: "Academic publications",
    slug: "research-papers",
  },
  {
    icon: BookOpen,
    name: "E-books",
    desc: "Textbooks & references",
    slug: "e-books",
  },
];

const steps = [
  {
    n: "01",
    title: "Create Account",
    desc: "Create an account as a student, lecturer or researcher, totally free.",
  },
  {
    n: "02",
    title: "Upload",
    desc: "An admin reviews and approves your upload, usually within a day.",
  },
  {
    n: "03",
    title: "Available",
    desc: "Once approved, your resource is discoverable and downloadable by the community.",
  },
  {
    n: "04",
    title: "Browse Resources",
    desc: "Browse structured academic contents.",
  },
  {
    n: "05",
    title: "Preview Instantly",
    desc: "Preview academic resources before download.",
  },
  {
    n: "06",
    title: "Download (Premium)",
    desc: "Premium subscription required before academic resources download.",
  },
];

const testimonials = [
  {
    name: "Adaeze N.",
    role: "300L, Computer Science, MOUAU",
    quote:
      "Aneks Library saved my semester. Every past question I needed was one search away — and the interface actually feels premium.",
  },
  {
    name: "Dr. Ibrahim K.",
    role: "Lecturer, Electrical Engineering, MOUAU",
    quote:
      "Distributing course materials used to mean five emails and a WhatsApp group. Now students just find them here.",
  },
  {
    name: "Chidinma O.",
    role: "400L, Department of Chemistry, MOUAU",
    quote:
      "The moderation queue keeps quality high. It reads like a real academic archive, not a random file dump.",
  },
];

const faqs = [
  {
    q: "Can I use Aneks Library for free?",
    a: "Yes. Free members can browse, preview, read, and bookmark resources. Premium members enjoy unlimited downloads, exclusive materials and an ad-free experience.",
  },
  {
    q: "Why Premium?",
    a: "Premium keeps the platform sustainable while allowing us to maintain high-quality academic resources for students.",
  },
  {
    q: "Do I need approval to upload?",
    a: "No. You can upload anytime. An admin reviews each resource before it goes public to keep quality high.",
  },
  {
    q: "Who can access my uploads?",
    a: "Approved resources are visible to everyone. Pending or rejected uploads are visible only to you and admins.",
  },
  {
    q: "Can lecturers approve resources?",
    a: "No. Only admins can approve, reject or delete resources. Lecturers upload and manage their own contributions.",
  },
  {
    q: "How is my data protected?",
    a: "We use row-level security, private storage buckets and signed download URLs. Only you control your account.",
  },
];

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

function Header() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 sm:px-6 md:h-14 md:px-4 lg:h-16 lg:px-6">
        <Link to="/" className="flex items-center gap-0.5">
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
          <a
            href="#about"
            className="transition-colors hover:text-foreground"
          >
            About
          </a>

          <a
            href="#features"
            className="transition-colors hover:text-foreground"
          >
            Features
          </a>

          <a
            href="#categories"
            className="transition-colors hover:text-foreground"
          >
            Categories
          </a>

          {/* <Link
            to="/pricing"
            className="transition-colors hover:text-primary font-medium"
          >
            Pricing
          </Link> */}

          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>

          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>

          <a
            href="#contact"
            className="transition-colors hover:text-foreground"
          >
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-2 md:gap-1.5 lg:gap-2">
          <ThemeToggle />

          {session ? (
           <Button
  asChild
  size="sm"
  className="bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:px-2.5 md:text-xs lg:px-3 lg:text-sm"
>
  <Link to="/dashboard">
    <span className="hidden sm:inline">
      Open Dashboard
    </span>

    <span className="transition-colors sm:hidden">
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
    <span className="hidden transition-colors sm:inline">
      Get Started
    </span>

    <span className="transition-colors group-hover:text-primary sm:hidden">
      Get Started
    </span>
  </Link>
</Button>
          )}

          <button
            onClick={() => setOpen(!open)}
            className="cursor-pointer rounded-sm border border-border bg-card p-2 shadow-soft md:hidden"
            aria-label="Toggle menu"
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
              <a
                href="#about"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-3 transition hover:bg-muted"
              >
                About
              </a>

              <a
                href="#features"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                Features
              </a>

              <a
                href="#categories"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                Categories
              </a>

              {/* <Link
                to="/pricing"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                Pricing
              </Link> */}

              <a
                href="#how"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                How it works
              </a>

              <a
                href="#faq"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                FAQ
              </a>

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 hover:bg-muted"
              >
                Contact
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header />

      {/* HERO — split screen */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]" />

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-5 sm:px-6 md:gap-7 md:px-4 md:py-5 lg:gap-8 lg:px-6 lg:py-8 xl:py-12 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-sm border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft md:px-3 md:py-1 md:text-[11px] lg:px-3 lg:py-1 lg:text-xs">
              <Sparkles className="h-3.5 w-3.5 text-gold md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5" />
              Designed for MOUAU Students
            </div>

            <h1 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:mt-4 md:text-[2.75rem] lg:mt-4 lg:text-5xl">
              <span className="text-gold">Smart Digital Library,</span> built
              for Academic Excellence
            </h1>

            <div className="mt-6 flex flex-wrap gap-3 md:mt-5 md:gap-2.5 lg:mt-6 lg:gap-3">
              <Button
  asChild
  size="lg"
  className="group bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
>
  <Link to="/auth" search={{ mode: "register" }}>
    <span className="transition-colors">
      Get started
    </span>
    <ArrowRight className="ml-1 h-4 w-4 transition-colors md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
  </Link>
</Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
              >
                <Link to="/dashboard">Login</Link>
              </Button>

              {/* <Button asChild size="lg" variant="outline">
                <Link to="/pricing">Premium Plans</Link>
              </Button> */}
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-4 md:gap-2.5 lg:mt-8 lg:gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-sm border border-border/60 bg-card/60 p-3 shadow-soft sm:p-4 md:rounded-sm md:p-3 lg:rounded-sm lg:p-4"
                >
                  <dt className="break-words text-xs uppercase tracking-wider text-muted-foreground md:text-[10px] lg:text-xs">
                    {s.label}
                  </dt>

                  <dd className="mt-1 break-words font-display text-xl font-semibold md:text-xl lg:text-xl">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative flex h-full">
            {/* Glow */}
            <div className="absolute -inset-6 -z-10 rounded-sm bg-gradient-emerald opacity-20 blur-3xl" />

            {/* Image */}
            <div className="w-full overflow-hidden rounded-sm border border-border shadow-elegant md:rounded-sm lg:rounded-sm">
              <img
                src={heroImg}
                alt="Illustration of an academic library reading room"
                width={1280}
                height={1024}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Floating Card */}
            <div className="absolute bottom-6 left-6 hidden max-w-[220px] rounded-sm border border-border bg-card p-4 shadow-elegant sm:block md:bottom-5 md:left-5 md:max-w-[190px] md:rounded-sm md:p-3.5 lg:bottom-6 lg:left-6 lg:max-w-[220px] lg:rounded-sm lg:p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground md:text-[10px] lg:text-xs">
                <Users className="h-3.5 w-3.5 text-primary md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5" />
                Helped Students
              </div>

              <div className="mt-1 font-display text-2xl font-semibold md:text-[1.35rem] lg:text-2xl">
                10k+
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-1 max-w-7xl">
            <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
              ABOUT
            </p>

            <h2 className="mt-3 mw-xs font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
              Centralizing Academic Resources for MOUAU
            </h2>

            <p className="mt-8 text-lg leading-8 text-muted-foreground md:mt-6 md:text-sm md:leading-6.5 lg:mt-8 lg:text-lg lg:leading-8">
              Aneks Library is a modern academic knowledge management platform
              developed specifically for Michael Okpara University of
              Agriculture, Umudike (MOUAU). It centralizes lecture notes, past
              questions, seminar papers, research materials, projects and
              other academic resources into one secure, well-organized digital
              library. The platform eliminates the difficulty of finding
              quality academic materials, by providing structured resources
              for every college and department within the university.
            </p>

            <p className="mt-6 text-lg leading-8 text-muted-foreground md:mt-5 md:text-sm md:leading-6.5 lg:mt-6 lg:text-lg lg:leading-8">
              Our mission is to improve learning efficiency, preserve valuable
              academic resources and build a trusted digital ecosystem that
              supports academic excellence across MOUAU, with future expansion
              to other universities.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="border-t border-border/60"
      >
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-14 max-w-1xl md:mb-9 lg:mb-14">
            <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
              Features
            </p>

            <h2 className="mt-3 mw-xs font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
              Built to Make Academic Resources Fast, Safe, and Accessible
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-3 lg:gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-sm border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant md:rounded-sm md:p-5 lg:rounded-sm lg:p-6"
              >
                <span className="inline-grid h-10 w-10 place-items-center rounded-sm bg-primary/10 text-primary md:h-9 md:w-9 md:rounded-sm lg:h-10 lg:w-10 lg:rounded-sm">
                  <f.icon className="h-5 w-5 md:h-4.5 md:w-4.5 lg:h-5 lg:w-5" />
                </span>

                <h3 className="mt-4 font-display text-lg font-semibold md:mt-3 md:text-base lg:mt-4 lg:text-lg">
                  {f.title}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground md:text-sm lg:text-sm">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-14 flex items-end justify-between gap-6 md:mb-9 md:gap-4 lg:mb-14 lg:gap-6">
            <div className="max-w-1xl">
              <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
                Categories
              </p>

              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
                Everything You Need to Excel Academically
              </h2>
            </div>

            <Button
              asChild
              variant="ghost"
              className="hidden sm:inline-flex md:h-9 md:px-2.5 md:text-sm lg:h-9 lg:px-3 lg:text-sm"
            >
              <Link to="/library">
                Browse library{" "}
                <ArrowRight className="ml-1 h-4 w-4 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-3 lg:gap-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/library"
                className="group rounded-sm border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant md:rounded-sm md:p-5 lg:rounded-sm lg:p-6"
              >
                <span className="inline-grid h-11 w-11 place-items-center rounded-sm bg-gradient-emerald text-primary-foreground md:h-10 md:w-10 md:rounded-sm lg:h-11 lg:w-11 lg:rounded-sm">
                  <c.icon className="h-5 w-5 md:h-4.5 md:w-4.5 lg:h-5 lg:w-5" />
                </span>

                <h3 className="mt-4 font-display text-lg font-semibold md:mt-3 md:text-base lg:mt-4 lg:text-lg">
                  {c.name}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground md:text-sm lg:text-sm">
                  {c.desc}
                </p>

                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 md:mt-3 md:text-[11px] lg:mt-4 lg:text-xs">
                  Browse <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-14 max-w-1xl md:mb-9 lg:mb-14">
            <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
              How it works
            </p>

            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
              Get Started in Minutes, Learn Without Limits
            </h2>
          </div>

          <ol className="grid gap-4 md:grid-cols-4 md:gap-3 lg:gap-4">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className="relative rounded-sm border border-border/60 bg-card p-6 shadow-soft md:rounded-sm md:p-5 lg:rounded-sm lg:p-6"
              >
                <div className="flex items-center gap-3 md:gap-2.5 lg:gap-3">
                  <span className="font-display text-3xl font-semibold text-gold md:text-[1.65rem] lg:text-3xl">
                    {s.n}
                  </span>

                  {i < steps.length - 1 && (
                    <span
                      className="hidden h-px flex-1 bg-border md:block"
                      aria-hidden
                    />
                  )}
                </div>

                <h3 className="mt-4 font-display text-lg font-semibold md:mt-3 md:text-base lg:mt-4 lg:text-lg">
                  {s.title}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground md:text-sm lg:text-sm">
                  {s.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-14 max-w-1xl md:mb-9 lg:mb-14">
            <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
              Voices
            </p>

            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
              Trusted by students, lecturers and researchers
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-3 lg:gap-4">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="rounded-sm border border-border/60 bg-card p-6 shadow-soft md:rounded-sm md:p-5 lg:rounded-sm lg:p-6"
              >
                <blockquote className="text-sm leading-relaxed text-foreground md:text-sm lg:text-sm">
                  "{t.quote}"
                </blockquote>

                <figcaption className="mt-6 flex items-center gap-3 md:mt-5 md:gap-2.5 lg:mt-6 lg:gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-emerald text-sm font-medium text-primary-foreground md:h-9 md:w-9 md:text-xs lg:h-10 lg:w-10 lg:text-sm">
                    {t.name[0]}
                  </span>

                  <div>
                    <div className="text-sm font-medium md:text-sm lg:text-sm">
                      {t.name}
                    </div>

                    <div className="text-xs text-muted-foreground md:text-[11px] lg:text-xs">
                      {t.role}
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <div className="mb-10 text-left md:mb-8 lg:mb-10">
            <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
              FAQ
            </p>

            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
              Quich Answers to Common questions
            </h2>
          </div>

          <Accordion
            type="single"
            collapsible
            className="rounded-sm border border-border/60 bg-card px-4 shadow-soft md:rounded-sm md:px-4 lg:rounded-sm lg:px-4"
          >
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border/60 last:border-b-0"
              >
                <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
                  {f.q}
                </AccordionTrigger>

                <AccordionContent className="text-sm text-muted-foreground md:text-sm lg:text-sm">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-18 text-left sm:px-6 md:px-4 md:py-12 lg:px-6 lg:py-18">
          <p className="text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
            Contact
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
            Questions, Feedback, or Support? Talk to Us
          </h2>

          <p className="mt-3 text-muted-foreground md:text-sm lg:text-sm">
            Reach out on email or WhatsApp — we usually respond within a few
            hours.
          </p>

          <div className="mt-8 flex flex-wrap justify-left gap-3 md:mt-6 md:gap-2.5 lg:mt-8 lg:gap-3">
            <Button
              asChild
              size="lg"
              className="group bg-gradient-emerald text-white !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
            >
              <a href="mailto:aneksdev@gmail.com">
                <Mail className="mr-2 h-4 w-4 transition-colors md:mr-1.5 md:h-3.5 md:w-3.5 lg:mr-2 lg:h-4 lg:w-4" />
                <span className="transition-colors">
                  Email us
                </span>
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-muted shadow-elegant transition-all hover:bg-none hover:bg-accent hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
            >
              <a
                href="https://wa.me/2349067627242"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4 md:mr-1.5 md:h-3.5 md:w-3.5 lg:mr-2 lg:h-4 lg:w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-1 py-14 sm:px-6 md:grid-cols-4 md:gap-6 md:px-4 md:py-12 lg:gap-10 lg:px-6 lg:py-14">
          <div>
            <div className="flex items-center gap-0.5">
              <img
                src={logo}
                alt="Aneks Library"
                className="h-9 w-9 rounded-sm object-contain md:h-8 md:w-8 lg:h-9 lg:w-9"
              />

              <span className="-ml-1 font-display text-lg font-semibold md:text-base lg:text-lg">
                <span className="text-gold">neks</span> Library
              </span>
            </div>

            <p className="mt-3 text-sm text-muted-foreground md:mt-2 md:text-sm lg:mt-3 lg:text-sm">
              The official digital academic library built for Michael Okpara
              University of Agriculture, Umudike (MOUAU). Helping students
              study smarter.
            </p>
          </div>

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
                <a href="#about" className="hover:text-foreground">
                  About
                </a>
              </li>

              <li>
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
              </li>

              <li>
                <a href="#categories" className="hover:text-foreground">
                  Categories
                </a>
              </li>

              {/* <li>
                <Link to="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li> */}
            </ul>
          </div>

          <div>
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

        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-8xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 md:px-4 md:py-5 lg:px-6 lg:py-6">
            <p>
              © {new Date().getFullYear()} Aneks Library. All rights reserved.
            </p>
            <p>Built by AneksDev Technologies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
