import {
  CalendarCog,
  FolderGit2,
  type LucideIcon,
  MessageSquareText,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { connection } from "next/server";
import { type ComponentType, Suspense } from "react";
import {
  GitHubIcon,
  LinkedInIcon,
  MaltIcon,
} from "@/components/demo/brand-icons";
import { ContactForm } from "@/components/demo/contact-form";
import { RoleChooser } from "@/components/demo/role-chooser";
import { SchedulePreview } from "@/components/demo/schedule-preview";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { softCodeStyle } from "@/lib/colors";
import { SHIFT_CODE_COLORS } from "@/lib/domain/seed-mapping";
import { cn } from "@/lib/utils";
import { getEmployees } from "@/server/queries/reference";

export const metadata: Metadata = {
  title: "Staff scheduling, built for your team",
  description:
    "Live demo of a staff scheduling app by Lucien Andrieux, freelance developer. Try it, then have your own built with your rules and branding.",
};

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const LINKS = {
  linkedin: "https://www.linkedin.com/in/lucienandrieux/",
  github: "https://github.com/LucienAndrieux",
  malt: "https://www.malt.fr/profile/lucienandrieux",
  repo: "https://github.com/LucienAndrieux/shift-smith",
};

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: "Live validation",
    text: "Rest time, rest days, weekends, couples, leave and staffing checked on every change.",
  },
  {
    icon: Wand2,
    title: "One-click fixes",
    text: "Each error comes with up to five local repairs that add no new error.",
  },
  {
    icon: CalendarCog,
    title: "Full-month generation",
    text: "A solver drafts a whole month around rules, preferences and leave.",
  },
  {
    icon: MessageSquareText,
    title: "Plain-language requests",
    text: "“Yuki can't work mornings next week” becomes changes a manager approves.",
  },
];

/** What a custom build adapts, each marked with a shift code of the demo. */
const OFFER: { code: string; title: string; text: string }[] = [
  {
    code: "A",
    title: "Your rules",
    text: "Rest periods, contracts, rotations and collective agreements, checked as you plan.",
  },
  {
    code: "B",
    title: "Your branding",
    text: "Your logo, colours, domain name and the words your team already uses.",
  },
  {
    code: "C",
    title: "Your workflow",
    text: "Roles, approvals, employee requests, notifications and printable sheets.",
  },
  {
    code: "D",
    title: "Your tools",
    text: "Imports and exports with payroll, HR or time-clock software.",
  },
  {
    code: "E",
    title: "Your hosting",
    text: "On your own server, or run for you with backups and updates.",
  },
];

const CONTACTS: {
  href: string;
  label: string;
  handle: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    href: LINKS.linkedin,
    label: "LinkedIn",
    handle: "in/lucienandrieux",
    icon: LinkedInIcon,
  },
  {
    href: LINKS.malt,
    label: "Malt",
    handle: "lucienandrieux",
    icon: MaltIcon,
  },
  {
    href: LINKS.github,
    label: "GitHub",
    handle: "LucienAndrieux",
    icon: GitHubIcon,
  },
  {
    href: LINKS.repo,
    label: "Source code of this demo",
    handle: "shift-smith",
    icon: FolderGit2,
  },
];

const HEADING = "font-[family-name:var(--font-display)] tracking-tight";

export default function StartPage() {
  return (
    <div
      className={cn(
        display.variable,
        "relative isolate flex min-h-dvh flex-col overflow-hidden scroll-smooth",
      )}
    >
      <Backdrop />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <a
          href="#demo"
          className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          <Logo animated className="size-10 sm:size-12" />
          ShiftSmith
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a
            href="#offer"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
          >
            Your own app
          </a>
          <a
            href="#contact"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
          >
            Contact
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* Demo */}
        <section
          id="demo"
          className="grid scroll-mt-6 grid-cols-1 items-start gap-12 pt-6 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-12"
        >
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live demo of a fictional hotel, restored every night
              </p>
              <h1
                className={cn(
                  HEADING,
                  "text-5xl leading-[0.98] font-bold text-balance sm:text-6xl",
                )}
              >
                A scheduling tool built around your team
                <span
                  aria-hidden
                  className="ml-1 inline-block size-[0.2em] translate-y-[-0.02em] rounded-[0.04em] bg-[#E8590C]"
                />
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
                ShiftSmith is the one I built for a 28-person hotel: rules
                checked as you plan, one-click fixes and a month drafted for
                you. Try it in one of three roles, then{" "}
                <a
                  href="#contact"
                  className="font-medium text-foreground underline decoration-[#E8590C] decoration-2 underline-offset-4 hover:decoration-[3px]"
                >
                  have yours built
                </a>
                .
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Pick a role to start, no account needed
              </h2>
              <Suspense fallback={<RolesSkeleton />}>
                <Roles />
              </Suspense>
            </div>
          </div>

          <div className="min-w-0 pb-12 lg:self-center lg:pb-0">
            <SchedulePreview />
          </div>
        </section>

        {/* What the demo already does */}
        <section
          aria-labelledby="features-title"
          className="flex flex-col gap-6 pb-24"
        >
          <h2 id="features-title" className={cn(HEADING, "text-2xl font-bold")}>
            What the demo already does
          </h2>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2 border-t pt-4">
                <f.icon className="size-5 text-[#E8590C]" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Custom build */}
        <section
          id="offer"
          className="grid scroll-mt-6 grid-cols-1 gap-12 border-t py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="flex flex-col gap-5">
            <h2
              className={cn(
                HEADING,
                "text-4xl leading-[1.02] font-bold text-balance sm:text-5xl",
              )}
            >
              Let&apos;s build yours
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
              I&apos;m Lucien Andrieux, a freelance developer. I build planning
              tools like this one for hotels, restaurants, clinics, shops and
              any team that works in shifts, shaped around how you already work.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                size="lg"
                className="bg-[#E8590C] text-white hover:bg-[#cf4f0b]"
              >
                <a href="#contact">Discuss your project</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={LINKS.repo} target="_blank" rel="noopener noreferrer">
                  <GitHubIcon className="size-4" /> Read the source code
                </a>
              </Button>
            </div>
          </div>

          <ul className="flex flex-col divide-y">
            {OFFER.map((o) => (
              <li key={o.code} className="flex gap-4 py-4 first:pt-0">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                  style={softCodeStyle(SHIFT_CODE_COLORS[o.code])}
                >
                  {o.code}
                </span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-semibold">{o.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {o.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="grid scroll-mt-6 grid-cols-1 gap-10 border-t py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h2
                className={cn(
                  HEADING,
                  "text-4xl leading-[1.02] font-bold text-balance",
                )}
              >
                Tell me about your schedule
              </h2>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                How many people, how you plan today and what slows you down. I
                reply within two working days with questions or a first
                proposal.
              </p>
            </div>
            <ul className="flex flex-col divide-y rounded-xl border bg-card/60 backdrop-blur">
              {CONTACTS.map((c) => (
                <li key={c.href}>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <c.icon className="size-5 text-foreground/80" />
                    <span className="flex-1 font-medium">{c.label}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {c.handle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t px-4 py-8 text-sm text-muted-foreground sm:px-6">
        ShiftSmith is built by Lucien Andrieux. Every person, place and schedule
        in the demo is fictional.
      </footer>
    </div>
  );
}

/** Dot texture fading out, with two soft colour glows. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [mask-image:radial-gradient(ellipse_80%_40%_at_50%_0%,black,transparent)] [background-size:22px_22px]" />
      <div className="absolute -top-48 left-1/2 h-[520px] w-[min(1000px,140vw)] -translate-x-1/2 rounded-full bg-[#E8590C]/15 blur-3xl dark:bg-[#E8590C]/10" />
      <div className="absolute top-80 -right-32 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/10" />
    </div>
  );
}

async function Roles() {
  // Request time: the demo restore re-creates the employees (new ids).
  await connection();
  const employees = (await getEmployees())
    .filter((e) => e.status === "active")
    .sort(
      (a, b) =>
        a.sectionSortOrder - b.sectionSortOrder ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((e) => ({ id: e.id, name: e.displayName, section: e.sectionName }));
  return <RoleChooser employees={employees} />;
}

function RolesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
