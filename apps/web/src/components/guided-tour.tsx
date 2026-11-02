"use client";

import { type DriveStep, driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./guided-tour.css";
import { Compass } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { Role } from "@/server/session";

/**
 * `data-tour` target of each step, in the order of `t.tour[role]`; null: a
 * centred card. A target missing from the page (another screen, phone drawer
 * closed) also falls back to a centred card.
 */
const TARGETS: Record<Role, (string | null)[]> = {
  manager: [
    null,
    "schedule-actions",
    "schedule-views",
    "nav-validation",
    "nav-constraints",
    "tour-actions",
  ],
  employee: [
    null,
    "schedule-views",
    "nav-profile",
    "nav-requests",
    "tour-actions",
  ],
  viewer: [null, "schedule-views", "nav", "tour-actions"],
};

/** The tour runs on the schedule screen, where most targets live. */
const TOUR_PATH = "/schedule";

/** Per guest and role: changing role keeps the same guest. */
const seenKey = (userId: string, role: Role) =>
  `shiftsmith:tour-seen:${userId}:${role}`;

/**
 * The visible element of a target: the router keeps previous pages mounted but
 * hidden, so the same target can appear more than once.
 */
function findTarget(target: string): HTMLElement | undefined {
  return [...document.querySelectorAll(`[data-tour="${target}"]`)].find(
    (e): e is HTMLElement =>
      e instanceof HTMLElement && e.getClientRects().length > 0,
  );
}

const navShown = () => findTarget("nav") !== undefined;

/** One tour at a time, whichever banner (visible or kept hidden) started it. */
let tourRunning = false;

/**
 * Resolves once every target has streamed in (schedule and sidebar are separate
 * Suspense boundaries), or after a few seconds.
 */
function waitForTargets(targets: (string | null)[]): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (
        targets.every(
          // Sidebar targets do not exist while the phone drawer is closed.
          (t) => !t || findTarget(t) || (t.startsWith("nav") && !navShown()),
        ) ||
        Date.now() - started > 4000
      )
        resolve();
      else window.setTimeout(check, 100);
    };
    check();
  });
}

/**
 * Short step-by-step tour of the current role, shown once per guest on the
 * schedule screen and replayed from the button it renders.
 */
export function GuidedTour({ role, userId }: { role: Role; userId: string }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const start = useCallback(async () => {
    if (tourRunning) return;
    tourRunning = true;
    await waitForTargets(TARGETS[role]);
    const steps: DriveStep[] = t.tour[role].map((step, i) => {
      const target = TARGETS[role][i];
      return {
        element: target ? findTarget(target) : undefined,
        popover: { title: step.title, description: step.text },
      };
    });
    const tour = driver({
      steps,
      showProgress: true,
      progressText: t.tour.progress,
      nextBtnText: t.tour.next,
      prevBtnText: t.tour.previous,
      doneBtnText: t.tour.done,
      popoverClass: "shiftsmith-tour",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 10,
      smoothScroll: true,
      onDestroyed: () => {
        tourRunning = false;
        try {
          localStorage.setItem(seenKey(userId, role), "1");
        } catch {
          // Storage blocked: the tour simply shows again next time.
        }
      },
    });
    tour.drive();
  }, [role, t, userId]);

  // First visit of this guest: start on the schedule screen.
  useEffect(() => {
    if (!pathname.startsWith(TOUR_PATH)) return;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(userId, role)) !== null;
    } catch {
      seen = true;
    }
    if (!seen || pending) {
      setPending(false);
      void start();
    }
  }, [pathname, pending, role, start, userId]);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (pathname.startsWith(TOUR_PATH)) void start();
        else {
          setPending(true);
          router.push(TOUR_PATH);
        }
      }}
    >
      <Compass /> {t.tour.replay}
    </Button>
  );
}
