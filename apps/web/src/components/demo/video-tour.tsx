"use client";

import { Link2, Mail, Play, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The four explainer videos (`public/videos`), in the order of `t.start.videos`. They are
 * recorded in English with burned-in subtitles, between an animated intro and outro
 * (made with Remotion, kept out of the repo); `width`/`height` give each player
 * its frame before the file loads.
 */
const VIDEOS = [
  { file: "video-1", seconds: 105, width: 1280, height: 570 },
  { file: "video-2", seconds: 81, width: 1280, height: 570 },
  { file: "video-3", seconds: 162, width: 1280, height: 570 },
  { file: "video-4", seconds: 118, width: 1280, height: 604 },
];

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Link to one video: the start page opens on the videos section with that video
 * picked (`?video=` is 1-based), in the sharer's language.
 */
function videoLink(index: number, locale: string) {
  const url = new URL("/start", window.location.origin);
  url.searchParams.set("video", String(index + 1));
  url.searchParams.set("lang", locale);
  url.hash = "videos";
  return url.toString();
}

/** `?video=` of the current URL as an index into `VIDEOS`, if valid. */
function linkedVideo() {
  const n = Number(new URLSearchParams(window.location.search).get("video"));
  return Number.isInteger(n) && n >= 1 && n <= VIDEOS.length ? n - 1 : null;
}

/**
 * Share menu of the playing video: copy the link, email, LinkedIn, WhatsApp and
 * the system share sheet where the browser has one. The player's own "⋮" menu
 * belongs to the browser and cannot take a share item.
 */
function ShareVideo({ index, title }: { index: number; title: string }) {
  const t = useT();
  const locale = useLocale();
  // Known only in the browser: rendered after mount to match the server HTML.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(videoLink(index, locale));
      toast.success(t.start.shareCopied);
    } catch {
      toast.error(t.start.shareCopyFailed);
    }
  }

  function open(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function systemShare() {
    try {
      await navigator.share({ title, url: videoLink(index, locale) });
    } catch {
      // Closed by the visitor, or refused: nothing to report.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Share2 />
          {t.start.shareVideo}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copy}>
          <Link2 />
          {t.start.shareCopyLink}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const link = videoLink(index, locale);
            // Same tab: a mail client opens, the page stays.
            window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}
${link}`)}`;
          }}
        >
          <Mail />
          {t.start.shareEmail}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            open(
              `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(videoLink(index, locale))}`,
            )
          }
        >
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            open(
              `https://wa.me/?text=${encodeURIComponent(`${title} ${videoLink(index, locale)}`)}`,
            )
          }
        >
          WhatsApp
        </DropdownMenuItem>
        {canShare && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={systemShare}>
              <Share2 />
              {t.start.shareMore}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One player and the list of videos: picking one plays it, and the next one
 * follows when a video ends.
 */
export function VideoTour({
  videos,
}: {
  videos: Dictionary["start"]["videos"];
}) {
  const [active, setActive] = useState(0);
  // Off on load: a video only plays once the visitor picks one or presses play.
  const [autoplay, setAutoplay] = useState(false);
  const video = VIDEOS[active];

  // A shared link (`?video=`) opens on that video, without playing it.
  useEffect(() => {
    const linked = linkedVideo();
    if (linked !== null) setActive(linked);
  }, []);

  function pick(index: number) {
    setActive(index);
    setAutoplay(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-8">
      {/* self-center: the frame keeps the video's height instead of
          stretching to the list's, which left a black band under it. */}
      <div className="flex flex-col gap-3 self-center">
        <div className="overflow-hidden rounded-2xl border bg-black shadow-sm">
          <video
            // A new file: a fresh element, so the poster and progress reset.
            key={video.file}
            src={`/videos/${video.file}.mp4`}
            poster={`/videos/${video.file}.jpg`}
            width={video.width}
            height={video.height}
            aria-label={videos[active].title}
            controls
            playsInline
            preload="metadata"
            autoPlay={autoplay}
            onEnded={() => {
              if (active < VIDEOS.length - 1) pick(active + 1);
            }}
            className="block h-auto w-full"
          >
            {/* The same English text as the burned-in subtitles, for screen
              readers and players that read captions; off by default. */}
            <track
              kind="captions"
              src={`/videos/${video.file}.vtt`}
              srcLang="en"
              label="English"
            />
          </video>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium">
            {videos[active].title}
          </p>
          <ShareVideo index={active} title={videos[active].title} />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {videos.map((v, i) => (
          <li key={VIDEOS[i].file}>
            <button
              type="button"
              aria-current={i === active ? "true" : undefined}
              onClick={() => pick(i)}
              className={cn(
                "group flex w-full items-start gap-3 rounded-xl border bg-card/60 p-3 text-left backdrop-blur transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-[#E8590C]/50 focus-visible:outline-none",
                i === active && "border-[#E8590C]/60 bg-[#E8590C]/5",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground transition-colors",
                  i === active && "bg-[#E8590C] text-white",
                )}
              >
                {i === active ? (
                  <Play className="size-3.5 fill-current" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{v.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {duration(VIDEOS[i].seconds)}
                  </span>
                </span>
                <span className="text-sm leading-snug text-muted-foreground">
                  {v.text}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
