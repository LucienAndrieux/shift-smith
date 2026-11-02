import type { Metadata } from "next";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";

/**
 * Link previews (WhatsApp, LinkedIn, email…): Open Graph and Twitter tags with the
 * image of `app/api/og` in the page's language. Relative URLs resolve against
 * the root layout's `metadataBase`.
 */
export function linkPreview(
  locale: Locale,
  title: string,
  description: string,
): Pick<Metadata, "openGraph" | "twitter"> {
  const image = {
    url: `/api/og?lang=${locale}`,
    width: 1200,
    height: 630,
    alt: title,
  };
  return {
    openGraph: {
      type: "website",
      siteName: "ShiftSmith",
      locale: LOCALE_TAGS[locale].replace("-", "_"),
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
