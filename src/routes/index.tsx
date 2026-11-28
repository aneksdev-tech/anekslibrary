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
  CalendarDays,
  FileText,
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
  { label: "Resources", value: "20+" },
  { label: "Departments", value: "60+" },
  { label: "Downloads", value: "300+" },
  { label: "Active Users", value: "10+" },
];


const features = [
  {
    icon: BookOpen,
    title: "Centralized Academic Resource Discovery",
    desc: "Explore a structured digital library of academic materials across departments and disciplines. Find relevant resources through organized categories, departmental classification, search and filtering.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Study Assistant",
    desc: "Get help understanding academic concepts, asking questions and exploring ideas. Free members can access basic text-based assistance, while Premium members enjoy document analysis, image-based questions, voice interactions and higher AI usage limits.",
  },
  {
    icon: FileQuestion,
    title: "Secure Document Preview",
    desc: "View supported academic documents through controlled, paginated previews that protect original files from unrestricted access.",
  },
  {
    icon: Bookmark,
    title: "Personal Resource Bookmarks",
    desc: "Save useful academic materials and build a personal collection you can conveniently revisit whenever you need them.",
  },
  {
    icon: Upload,
    title: "Academic Resource Contributions",
    desc: "Upload and share useful academic materials with the community. Submitted resources go through a structured review process before becoming available to other users.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Access Management",
    desc: "Role-aware permissions, protected resource storage and controlled access help safeguard academic materials and user accounts.",
  },
  {
    icon: Users,
    title: "Multi-Role Academic Community",
    desc: "Dedicated access experiences for students, lecturers, researchers, staff and platform administrators.",
  },
  {
    icon: UserCog,
    title: "Administrative Management",
    desc: "Manage users, academic resources, approval workflows and platform activities through dedicated administrative interfaces.",
  },
];

const categories = [
  {
    icon: ClipboardList,
    name: "Assignments",
    desc: "Coursework, take-home exercises, practical tasks and academic assignments designed to support learning, independent study and continuous assessment.",
    slug: "assignments",
  },
  {
    icon: FileQuestion,
    name: "Past Questions",
    desc: "Previous examination and test questions that help students understand assessment patterns, practise answering questions and prepare more effectively for examinations.",
    slug: "past-questions",
  },
  {
    icon: FlaskConical,
    name: "Publications",
    desc: "Scholarly articles, journals, conference papers and other published academic works that support research, knowledge sharing and further academic exploration.",
    slug: "publications",
  },
  {
    icon: NotebookPen,
    name: "Lecture Notes",
    desc: "Course notes, lecture materials, study guides and supplementary learning documents that help students understand topics covered across their academic programmes.",
    slug: "lecture-notes",
  },
  {
    icon: BookOpen,
    name: "E-books",
    desc: "Digital textbooks, academic books, reference materials and educational reading resources covering different subjects, disciplines and areas of study.",
    slug: "e-books",
  },
  {
    icon: CalendarDays,
    name: "Lecture Timetables",
    desc: "Departmental and course lecture schedules showing class days, times and other timetable information to help students organize their academic activities.",
    slug: "lecture-timetables",
  },
  {
    icon: FileText,
    name: "Handouts",
    desc: "Lecturer-provided course handouts, supplementary reading materials, instructional documents and other resources prepared to support classroom learning.",
    slug: "handouts",
  },
  {
    icon: FolderKanban,
    name: "Reports",
    desc: "Academic reports, project documentation, seminar reports, practical reports and other structured academic submissions produced for coursework and research activities.",
    slug: "reports",
  },
];


const steps = [
  {
    n: "01",
    title: "Create Your Account",
    desc: "Register for free and access Aneks Library as a member of the academic community.",
  },
  {
    n: "02",
    title: "Explore the Library",
    desc: "Discover academic materials across departments and categories using search, filters and organized resource listings.",
  },
  {
    n: "03",
    title: "Preview Resources",
    desc: "Explore supported documents through secure previews before deciding which materials you need.",
  },
  {
    n: "04",
    title: "Save Useful Materials",
    desc: "Bookmark important resources and build a personal collection you can conveniently revisit whenever you need them.",
  },
  {
    n: "05",
    title: "Download or Purchase",
    desc: "Use Premium Download Credits to access eligible resources. Premium includes 10 monthly credits, while marketplace resources are purchased separately.",
  },
  {
    n: "06",
    title: "Contribute and Share",
    desc: "Upload useful academic materials for review. Once approved, your contributions become available to the academic community.",
  },
];


const testimonials = [
  {
    name: "Student Experience",
    role: "Illustrative student perspective",
    quote:
      "Finding past questions, lecture notes and other study materials in one organized platform can make academic preparation much easier.",
  },
  {
    name: "Lecturer Experience",
    role: "Illustrative lecturer perspective",
    quote:
      "A centralized academic resource platform provides a more organized way to share course materials and make them accessible to students.",
  },
  {
    name: "Researcher Experience",
    role: "Illustrative researcher perspective",
    quote:
      "Having academic publications, reports and other research materials organized in one place makes discovering useful information more convenient.",
  },
];


const faqs = [
  {
    q: "Can I use Aneks Library for free?",
    a: "Yes. Free members can explore the library, browse and preview academic resources, read accessible materials, bookmark useful resources and upload academic materials. Premium membership provides an ad-free experience, access to exclusive materials and 10 monthly Download Credits.",
  },
  {
    q: "What do I get with Premium?",
    a: "Premium gives you an ad-free experience, access to exclusive academic materials and 10 Download Credits every billing month. You can also purchase additional Download Credits as a Premium member. Monthly credits expire when your billing period resets, and monthly credits are used before purchased credits.",
  },
  {
    q: "Are all academic resources downloaded with Download Credits?",
    a: "No. Eligible academic resources use Download Credits, with the credit cost assigned to each resource. Marketplace resources are purchased separately with money and do not use Download Credits.",
  },
  {
    q: "What is the AI Study Assistant?",
    a: "The AI Study Assistant helps users understand academic concepts, ask questions and get explanations. Free members can access basic text-based interactions, while Premium members enjoy additional capabilities, including academic document uploads and analysis, image-based questions, voice interactions and a higher AI usage allowance.",
  },
  {
    q: "Do I need approval to upload resources?",
    a: "You can submit academic materials whenever you are ready. Submitted resources go through a review process before they become available to the wider academic community.",
  },
  {
    q: "Who can access the resources I upload?",
    a: "Resource visibility depends on its approval status, category and access permissions. Some materials may be restricted to authorized users or Premium members. Pending and rejected submissions are not publicly available.",
  },
  {
    q: "How is my data protected?",
    a: "Aneks Library uses role-based access controls, database security policies and protected storage to safeguard accounts and academic resources. Secure access mechanisms help ensure that resources are only available to users with the appropriate permissions.",
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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background">
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

  <div className="mx-auto grid max-w-7xl gap-8 px-4 py-5 sm:px-6 md:grid-cols-2 md:gap-7 md:px-4 md:py-5 lg:gap-8 lg:px-6 lg:py-8 xl:py-12">
    <div className="flex flex-col justify-center">
      <div className="inline-flex w-fit items-center gap-2 rounded-sm border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft md:text-[11px] lg:text-xs">
        <Sparkles className="h-3.5 w-3.5 text-gold" />
        Designed for MOUAU's Academic Community
      </div>

      <h1 className="mt-4 font-display text-3xl font-semibold leading-[1.2] tracking-tight sm:text-5xl md:mt-4 md:text-[2.75rem] lg:mt-4 lg:text-5xl">
          Your Academic World,{" "}
        <span className="text-gold">
          Built for Academic Excellence
        </span>
      </h1>

      <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base md:mt-2 md:text-sm md:leading-6.5 lg:mt-2 lg:text-base lg:leading-7">
        Discover, access and manage academic resources in one intelligent
        digital platform. From lecture notes and past questions to research
        publications and projects, Aneks Library makes academic knowledge
        easier to find, share and preserve.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 md:mt-5 md:gap-2.5 lg:mt-6 lg:gap-3">
        <Button
          asChild
          size="lg"
          className="group bg-gradient-emerald text-white text-xs !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
        >
          <Link to="/auth" search={{ mode: "register" }}>
            <span className="transition-colors">
              Get Started
            </span>
            <ArrowRight className="ml-1 h-4 w-4 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
          </Link>
        </Button>        
<Button
  asChild
  size="lg"
  variant="outline"
  className="md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
>
  <Link to="/auth" search={{ mode: "login" }}>
    Login
  </Link>
</Button>

      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-4 md:gap-2.5 lg:mt-8 lg:gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-sm border border-border/60 bg-card/60 p-3 shadow-soft sm:p-4 md:p-3 lg:p-4"
          >
            <dt className="break-words text-xs uppercase tracking-wider text-muted-foreground md:text-[10px] lg:text-xs">
              {s.label}
            </dt>

            <dd className="mt-1 break-words font-display text-xl font-semibold">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>

    <div className="relative flex h-full">
      <div className="absolute -inset-6 -z-10 rounded-sm bg-gradient-emerald opacity-20 blur-3xl" />

      <div className="w-full overflow-hidden rounded-sm border border-border shadow-elegant">
        <img
          src={heroImg}
          alt="Aneks Library digital academic learning environment"
          width={1280}
          height={1024}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="absolute bottom-6 left-6 hidden max-w-[220px] rounded-sm border border-border bg-card p-4 shadow-elegant sm:block md:bottom-5 md:left-5 md:max-w-[190px] md:p-3.5 lg:bottom-6 lg:left-6 lg:max-w-[220px] lg:p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground md:text-[10px] lg:text-xs">
          <Users className="h-3.5 w-3.5 text-primary" />
          Helped Students
        </div>

        <div className="mt-1 font-display text-xl font-semibold md:text-[1.2rem] lg:text-2xl">
          2k+
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

      <h2 className="mt-6 mw-xs font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
        Your Digital Home for Academic Resources
      </h2>

      <p className="mt-6 text-lg leading-8 text-muted-foreground md:mt-6 md:text-sm md:leading-6.5 lg:mt-6 lg:text-lg lg:leading-8">
        Aneks Library is a digital academic resource management, access and
        distribution platform designed to bring academic knowledge closer
        to the people who need it. Built with the academic community of
        Michael Okpara University of Agriculture, Umudike (MOUAU) in mind,
        it provides a shared digital space where valuable academic materials
        can be discovered, accessed, contributed and preserved.
      </p>

      <p className="mt-6 text-lg leading-8 text-muted-foreground md:mt-5 md:text-sm md:leading-6.5 lg:mt-6 lg:text-lg lg:leading-8">
        More than a place to find lecture notes and past questions, Aneks
        Library is designed to support the wider academic journey — from
        everyday learning and examination preparation to research,
        knowledge sharing and academic collaboration. Its vision is to
        create a more connected academic community where knowledge is
        easier to access, share and build upon, with the potential to extend
        beyond MOUAU to other academic communities.
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

            <h2 className="mt-6 mw-xs font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
              Powerful Tools for a Smarter Academic Experience
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

              <h2 className="mt-6 font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
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

            
        <h2 className="mt-6 font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
          Getting Started with Aneks Library Is Simple
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
  Sample Experiences
</p>

<h2 className="mt-6 font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
  An Academic Experience Designed for Everyone
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

            
<h2 className="mt-6 font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
  Quick Answers to Common Questions
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

    <h2 className="mt-6 font-display text-3xl font-semibold sm:text-4xl md:mt-6 md:text-[1.7rem] lg:mt-6 lg:text-4xl">
      Need Help or Have a Question? Get in Touch
    </h2>

    <p className="mt-3 text-muted-foreground md:text-sm lg:text-sm">
      Whether you have a question, feedback, or need technical support,
      we're happy to hear from you. Reach out through email or WhatsApp
      and we'll get back to you as soon as possible.
    </p>

    <div className="mt-8 flex flex-nowrap items-center gap-3 md:mt-6 md:gap-2.5 lg:mt-8 lg:gap-3">
      <Button
        asChild
        size="lg"
        variant="outline"
        className="w-fit shrink-0 bg-muted shadow-elegant transition-all hover:bg-none hover:bg-accent hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
      >
        <a href="mailto:aneksdev@gmail.com">
          <Mail className="h-4 w-4 transition-colors md:mr-1.5 md:h-3.5 md:w-3.5 lg:mr-2 lg:h-4 lg:w-4" />
          <span className="transition-colors">Email us</span>
        </a>
      </Button>

      <Button
        asChild
        size="lg"
        className="w-fit shrink-0 group bg-gradient-emerald px-3 text-white !transition-none hover:bg-none hover:bg-accent hover:text-foreground hover:shadow-md md:h-10 md:px-3.5 md:text-sm lg:h-11 lg:px-4 lg:text-sm"
      >
        <a
          href="https://wa.me/2349067627242"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="h-4 w-4 md:mr-1.5 md:h-3.5 md:w-3.5 lg:mr-2 lg:h-4 lg:w-4" />
          WhatsApp
        </a>
      </Button>
    </div>
  </div>
</section>


      
{/* FOOTER */}
<footer className="border-t border-border/60">
  <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-4 md:gap-6 md:px-4 md:py-12 lg:gap-10 lg:px-6 lg:py-14">
    {/* Brand */}
    <div className="col-span-2 md:col-span-1">
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
        An independent digital academic resource platform designed
        for the MOUAU academic community. Making academic knowledge
        easier to discover, access, share and preserve.
      </p>

      <p className="mt-3 text-xs font-medium tracking-wide text-gold">
        Embrace Knowledge and Empower Minds
      </p>
    </div>

    {/* Company */}
    <div>
      <div className="mb-3 text-sm font-medium md:mb-2 md:text-sm lg:mb-3 lg:text-sm">
        Company
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground md:space-y-1.5 md:text-sm lg:space-y-2 lg:text-sm">
        <li>
          <a href="#about" className="hover:text-foreground">
            About Aneks Library
          </a>
        </li>

        <li>
          <a href="#contact" className="hover:text-foreground">
            Contact Us
          </a>
        </li>

        <li>
          <a
            href="mailto:aneksdev@gmail.com"
            className="hover:text-foreground"
          >
            Support
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
            Explore Library
          </Link>
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

        <li>
          <a href="#how" className="hover:text-foreground">
            How It Works
          </a>
        </li>

        <li>
          <a href="#faq" className="hover:text-foreground">
            FAQs
          </a>
        </li>
      </ul>
    </div>

    {/* Get in Touch */}
    <div className="col-span-2 md:col-span-1">
      <div className="mb-3 text-sm font-medium md:mb-2 md:text-sm lg:mb-3 lg:text-sm">
        Get in Touch
      </div>

      <p className="text-sm text-muted-foreground md:text-sm lg:text-sm">
        Have questions, suggestions or feedback? We'd love to hear from you.
      </p>

      <div className="mt-4 flex flex-col gap-3 md:mt-3 md:gap-2.5 lg:mt-4 lg:gap-3">
        <a
          href="mailto:aneksdev@gmail.com"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Mail className="h-4 w-4 text-gold" />
          Email us
        </a>

        <a
          href="https://wa.me/2349067627242"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4 text-gold" />
          WhatsApp
        </a>
      </div>
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
</div>
  );
}
