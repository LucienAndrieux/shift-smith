"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The four explainer videos (`public/videos`), in the order of `t.start.videos`. They are
 * recorded in English with burned-in subtitles; `width`/`height` give each player
 * its frame before the file loads.
 */
const VIDEOS = [
  { file: "video-1", seconds: 97, width: 1280, height: 570 },
  { file: "video-2", seconds: 73, width: 1280, height: 570 },
  { file: "video-3", seconds: 155, width: 1280, height: 570 },
  { file: "video-4", seconds: 110, width: 1280, height: 604 },
];

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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

  function pick(index: number) {
    setActive(index);
    setAutoplay(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-8">
      {/* self-center: the frame keeps the video's height instead of
          stretching to the list's, which left a black band under it. */}
      <div className="self-center overflow-hidden rounded-2xl border bg-black shadow-sm">
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
