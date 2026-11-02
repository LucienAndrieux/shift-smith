import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LOCALES } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { linkPreview } from "@/lib/og";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display face for page titles and the start page's headlines (`font-display`). */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return {
    // Absolute URLs for the link-preview image.
    metadataBase: new URL(
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    ),
    ...linkPreview(locale, "ShiftSmith", t.meta.description),
    title: {
      default: "ShiftSmith",
      template: "%s · ShiftSmith",
    },
    description: t.meta.description,
    // Google Search Console ownership of the public site (safe-browsing reviews).
    verification: { google: "QDCgaAzGrQ7qBrs6RXSyTl3FZEfKNUCvPsBhHBKcCoM" },
  };
}

/** One static shell per language (proxy.ts picks it from the cookie). */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider locale={locale}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
