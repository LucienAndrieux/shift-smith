import {
  CalendarCog,
  type LucideIcon,
  MessageSquareText,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RoleChooser } from "@/components/demo/role-chooser";
import { SchedulePreview } from "@/components/demo/schedule-preview";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployees } from "@/server/queries/reference";

export const metadata: Metadata = { title: "Try the demo" };

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
    text: "An OR-Tools solver drafts a whole month around rules, preferences and leave.",
  },
  {
    icon: MessageSquareText,
    title: "Plain-language requests",
    text: "“Yuki can't work mornings next week” becomes typed operations to approve.",
  },
];

export default function StartPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Backdrop />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Logo animated className="size-10 sm:size-12" />
          ShiftSmith
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pt-6 pb-16 sm:px-6 lg:pt-12">
        <section className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none">
            <div className="flex flex-col gap-5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live demo · fictional hotel, restored every night
              </span>
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
                Staff schedules that{" "}
                <span className="bg-gradient-to-r from-[#E8590C] to-amber-500 bg-clip-text text-transparent">
                  check themselves
                </span>
                .
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
                Plan a 28-person hotel month by month: every rule validated as
                you edit, one-click repairs, solver-generated drafts and
                requests written in plain language.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Pick a role to start — no account needed
              </h2>
              <Suspense fallback={<RolesSkeleton />}>
                <Roles />
              </Suspense>
            </div>
          </div>

          <div className="min-w-0 pb-12 lg:self-center lg:pb-0 animate-in fade-in slide-in-from-bottom-6 duration-1000 motion-reduce:animate-none">
            <SchedulePreview />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-2xl border bg-card/60 p-5 backdrop-blur"
            >
              <f.icon className="size-5 text-[#E8590C]" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {f.text}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        Every person, place and schedule here is fictional. Next.js · PostgreSQL
        · OR-Tools.
      </footer>
    </div>
  );
}

/** Dot texture fading out, with two soft colour glows. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)] [background-size:22px_22px]" />
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
