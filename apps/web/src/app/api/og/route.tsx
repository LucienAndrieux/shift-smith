import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

/**
 * Link preview image (Open Graph, 1200×630) of the start page, in the language of
 * `?lang=`: brand, headline and a slice of a schedule grid. Under `api/`, so the
 * language rewrite and the session redirect leave it alone.
 */

const BRAND = "#e8590c";
const INK = "#1a1a1a";

/** Shift and rest codes of the mini grid, one row per employee. */
const ROWS = [
  "AAOFOFBBB",
  "BBBAOFOFA",
  "DDDDOFOFD",
  "CCOFOFCCC",
  "OFAABBOFE",
].map((row) => row.match(/OF|[A-E]/g) ?? []);

const CODE_COLORS: Record<string, string> = {
  A: "#3b82f6",
  B: "#f59e0b",
  C: "#8b5cf6",
  D: "#334155",
  E: "#14b8a6",
  OF: "#22c55e",
};

/**
 * `amount` of `color` over white (or black): the app's soft code chips, which use
 * color-mix, unsupported here.
 */
function mix(color: string, amount: number, over: 0 | 255 = 255): string {
  const n = Number.parseInt(color.slice(1), 16);
  const c = (v: number) => Math.round(over + (v - over) * amount);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/** The 3×3 mark, ember block top right. */
function Logo({ size }: { size: number }) {
  const cell = size / 3.6;
  const gap = (size - cell * 3) / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ display: "flex", gap }}>
          {[0, 1, 2].map((col) => (
            <div
              key={col}
              style={{
                width: cell,
                height: cell,
                borderRadius: cell * 0.22,
                background: row === 0 && col === 2 ? BRAND : INK,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The start page's display font (OFL, assets/fonts). */
const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const fonts = Promise.all(
  ([400, 700] as const).map(async (weight) => ({
    name: "Bricolage Grotesque",
    weight,
    style: "normal" as const,
    data: await readFile(
      path.join(FONT_DIR, `bricolage-grotesque-latin-${weight}-normal.woff`),
    ),
  })),
);

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get("lang");
  const t = DICTIONARIES[isLocale(lang) ? lang : DEFAULT_LOCALE].start;
  const host = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).host
    : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: "64px 72px",
        background:
          "radial-gradient(circle at 92% 0%, #fde3d3 0%, #fbf7f4 45%, #f6f8fb 100%)",
        color: INK,
        fontFamily: "Bricolage Grotesque",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 640,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Logo size={56} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>ShiftSmith</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.5,
            }}
          >
            {t.headline}
          </div>
          <div style={{ fontSize: 27, lineHeight: 1.4, color: "#525866" }}>
            {t.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            color: "#525866",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: "#10b981",
            }}
          />
          {host}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 10,
          marginLeft: "auto",
          padding: 22,
          borderRadius: 24,
          background: "white",
          border: "1px solid #e7e5e4",
          boxShadow: "0 24px 48px -16px rgba(0, 0, 0, 0.18)",
          alignSelf: "center",
        }}
      >
        {ROWS.map((row, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed sample grid
          <div key={r} style={{ display: "flex", gap: 8 }}>
            {row.map((code, c) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed sample grid
                key={c}
                style={{
                  width: 46,
                  height: 46,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  fontSize: 18,
                  fontWeight: 700,
                  background: mix(CODE_COLORS[code], 0.28),
                  color: mix(CODE_COLORS[code], 0.6, 0),
                  border:
                    r === 3 && c === 6
                      ? "3px solid #ef4444"
                      : "3px solid transparent",
                }}
              >
                {code}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: await fonts,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
