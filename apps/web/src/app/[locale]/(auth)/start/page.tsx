import {
  BookOpen,
  CalendarCog,
  Check,
  FolderGit2,
  type LucideIcon,
  MessageSquareText,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
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
import { LanguageButtons } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { softCodeStyle } from "@/lib/colors";
import { SHIFT_CODE_COLORS } from "@/lib/domain/seed-mapping";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getEmployees } from "@/server/queries/reference";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.start.title, description: t.start.description };
}

const LINKS = {
  linkedin: "https://www.linkedin.com/in/lucienandrieux/",
  github: "https://github.com/LucienAndrieux",
  malt: "https://www.malt.fr/profile/lucienandrieux",
  repo: "https://github.com/LucienAndrieux/shift-smith",
  // Published Notion page, French and English.
  docs: "https://kind-grass-02d.notion.site/Shiftsmith-Documentation-40c3f4e4a1dd800ea9bcffd55609ecbd",
};

/** Icons of the feature list, in the order of `t.start.features`. */
const FEATURE_ICONS: LucideIcon[] = [
  ShieldCheck,
  Wand2,
  CalendarCog,
  MessageSquareText,
];

/**
 * What a custom build adapts (`t.start.offer`), each marked with a shift code of
 * the demo.
 */
const OFFER_CODES = ["A", "B", "C", "D", "E"];

/**
 * Prices in euros of the plans (`t.start.plans`, same order), excluding VAT; null:
 * on quote. One grid for every language, set for the Portuguese market.
 */
const PLAN_PRICES: ({ setup: number; monthly: number } | null)[] = [
  { setup: 1500, monthly: 49 },
  { setup: 2900, monthly: 89 },
  null,
];

/** Index of the highlighted plan. */
const POPULAR_PLAN = 1;

const CONTACTS: {
  href: string;
  /** A brand name, or a localized label. */
  label: string | ((t: Dictionary["start"]) => string);
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
    label: (t) => t.sourceOfDemo,
    handle: "shift-smith",
    icon: FolderGit2,
  },
  {
    href: LINKS.docs,
    label: (t) => t.documentation,
    handle: "Notion",
    icon: BookOpen,
  },
];

const HEADING = "font-display tracking-tight";

export default async function StartPage() {
  const t = await getT();
  const locale = await getLocale();
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden scroll-smooth">
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
            {t.start.navOffer}
          </a>
          <a
            href="#pricing"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
          >
            {t.start.navPricing}
          </a>
          <a
            href="#contact"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
          >
            {t.start.navContact}
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
              <LanguageButtons />
              <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t.start.liveDemo}
              </p>
              <h1
                className={cn(
                  HEADING,
                  "text-5xl leading-[0.98] font-bold text-balance sm:text-6xl",
                )}
              >
                {t.start.headline}
                <span
                  aria-hidden
                  className="ml-1 inline-block size-[0.2em] translate-y-[-0.02em] rounded-[0.04em] bg-[#E8590C]"
                />
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
                {t.start.introBefore}
                <a
                  href="#contact"
                  className="font-medium text-foreground underline decoration-[#E8590C] decoration-2 underline-offset-4 hover:decoration-[3px]"
                >
                  {t.start.introLink}
                </a>
                {t.start.introAfter}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t.start.pickRole}
              </h2>
              <Suspense fallback={<RolesSkeleton />}>
                <Roles />
              </Suspense>
            </div>
          </div>

          <div className="min-w-0 pb-12 lg:self-center lg:pb-0">
            <SchedulePreview t={t.preview} />
          </div>
        </section>

        {/* What the demo already does */}
        <section
          aria-labelledby="features-title"
          className="flex flex-col gap-6 pb-24"
        >
          <h2 id="features-title" className={cn(HEADING, "text-2xl font-bold")}>
            {t.start.featuresTitle}
          </h2>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.start.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div
                  key={f.title}
                  className="flex flex-col gap-2 border-t pt-4"
                >
                  <Icon className="size-5 text-[#E8590C]" />
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Custom build */}
        <section
          id="offer"
          className="grid scroll-mt-6 grid-cols-1 gap-12 border-t py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Image
                src="/lucien-andrieux.webp"
                alt="Lucien Andrieux"
                width={96}
                height={96}
                className="size-20 shrink-0 rounded-full object-cover ring-4 ring-[#E8590C]/15 sm:size-24"
              />
              <div className="flex flex-col">
                <span className="text-lg font-semibold">Lucien Andrieux</span>
                <span className="text-sm text-muted-foreground">
                  {t.start.developerRole}
                </span>
              </div>
            </div>
            <h2
              className={cn(
                HEADING,
                "text-4xl leading-[1.02] font-bold text-balance sm:text-5xl",
              )}
            >
              {t.start.offerTitle}
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
              {t.start.offerText}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                size="lg"
                className="bg-[#E8590C] text-white hover:bg-[#cf4f0b]"
              >
                <a href="#contact">{t.start.discuss}</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={LINKS.repo} target="_blank" rel="noopener noreferrer">
                  <GitHubIcon className="size-4" /> {t.start.readSource}
                </a>
              </Button>
            </div>
          </div>

          <ul className="flex flex-col divide-y">
            {t.start.offer.map((o, i) => (
              <li key={OFFER_CODES[i]} className="flex gap-4 py-4 first:pt-0">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                  style={softCodeStyle(SHIFT_CODE_COLORS[OFFER_CODES[i]])}
                >
                  {OFFER_CODES[i]}
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

        <Pricing t={t.start} locale={locale} />

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
                {t.start.contactTitle}
              </h2>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                {t.start.contactText}
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
                    <span className="flex-1 font-medium">
                      {typeof c.label === "string" ? c.label : c.label(t.start)}
                    </span>
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
        {t.start.footer}
      </footer>
    </div>
  );
}

/** The three plans: one-off build price, then a monthly plan. */
function Pricing({ t, locale }: { t: Dictionary["start"]; locale: Locale }) {
  const euros = new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="flex scroll-mt-6 flex-col gap-10 border-t py-20"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h2
          id="pricing-title"
          className={cn(
            HEADING,
            "text-4xl leading-[1.02] font-bold text-balance sm:text-5xl",
          )}
        >
          {t.pricingTitle}
        </h2>
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
          {t.pricingText}
        </p>
      </div>

      {/* Cards share their rows (subgrid) so prices and lists line up. */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-3">
        {t.plans.map((plan, i) => {
          const price = PLAN_PRICES[i];
          const popular = i === POPULAR_PLAN;
          return (
            <div
              key={plan.name}
              className={cn(
                "relative row-span-4 grid grid-rows-subgrid gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-7",
                popular && "border-[#E8590C] ring-4 ring-[#E8590C]/15",
              )}
            >
              {popular && (
                <span className="absolute top-0 left-6 -translate-y-1/2 rounded-full bg-[#E8590C] px-3 py-0.5 text-xs font-semibold text-white">
                  {t.pricingPopular}
                </span>
              )}
              <div className="flex flex-col gap-1">
                <h3 className={cn(HEADING, "text-2xl font-bold")}>
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground">{plan.text}</p>
              </div>

              {price ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">
                    {t.pricingFrom}
                  </span>
                  <span className={cn(HEADING, "text-4xl font-bold")}>
                    {euros.format(price.setup)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t.pricingSetup}
                  </span>
                  <span className="pt-2 font-semibold">
                    {t.pricingMonthly(euros.format(price.monthly))}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t.pricingMonthlyText}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">&nbsp;</span>
                  <span className={cn(HEADING, "text-4xl font-bold")}>
                    {t.pricingOnQuote}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t.pricingOnQuoteText}
                  </span>
                </div>
              )}

              <ul className="flex flex-col gap-2.5 border-t pt-5 text-sm">
                {plan.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#E8590C]" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                variant={popular ? "default" : "outline"}
                className={cn(
                  "self-end",
                  popular && "bg-[#E8590C] text-white hover:bg-[#cf4f0b]",
                )}
              >
                <a href="#contact">
                  {price ? t.pricingCta : t.pricingCtaCustom}
                </a>
              </Button>
            </div>
          );
        })}
      </div>

      <ul className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
        {t.pricingNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
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
