import type { Locale } from "@/lib/i18n/config";

/**
 * Flags drawn in SVG (emoji flags do not render on Windows): United Kingdom for
 * English, France, Portugal (simplified, without the coat of arms' detail).
 */
export function Flag({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      {locale === "en" && (
        <>
          <clipPath id="flag-uk">
            <rect width="60" height="40" />
          </clipPath>
          <g clipPath="url(#flag-uk)">
            <rect width="60" height="40" fill="#012169" />
            <path d="M0,0 60,40 M60,0 0,40" stroke="#fff" strokeWidth="8" />
            <path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" strokeWidth="3" />
            <path d="M30,0 v40 M0,20 h60" stroke="#fff" strokeWidth="12" />
            <path d="M30,0 v40 M0,20 h60" stroke="#C8102E" strokeWidth="7" />
          </g>
        </>
      )}
      {locale === "fr" && (
        <>
          <rect width="20" height="40" fill="#002654" />
          <rect x="20" width="20" height="40" fill="#fff" />
          <rect x="40" width="20" height="40" fill="#CE1126" />
        </>
      )}
      {locale === "pt" && (
        <>
          <rect width="24" height="40" fill="#046A38" />
          <rect x="24" width="36" height="40" fill="#DA291C" />
          <circle cx="24" cy="20" r="8" fill="#FFE900" />
          <path
            d="M19.5,15 h9 v7 a4.5,4.5 0 0 1 -9,0 z"
            fill="#fff"
            stroke="#DA291C"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}
