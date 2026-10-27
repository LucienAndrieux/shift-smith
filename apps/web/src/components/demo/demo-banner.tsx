"use client";

import { Eye, PencilRuler, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { enterDemo, resetMyDemo } from "@/app/demo-actions";
import { Button } from "@/components/ui/button";

/** Shown to demo guests: what they can do, switch mode, start over. */
export function DemoBanner({ mode }: { mode: "manager" | "viewer" }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
      <span className="flex-1">
        {mode === "manager"
          ? "Demo as a manager: duplicate a version or generate a month to get your own draft. Shared data is read-only; your work is deleted after 24 hours."
          : "Read-only demo: browse the published schedules, the hour bank and the reference data."}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(() => enterDemo(mode === "manager" ? "viewer" : "manager"))
        }
      >
        {mode === "manager" ? <Eye /> : <PencilRuler />}
        {mode === "manager" ? "Switch to read-only" : "Switch to manager"}
      </Button>
      {mode === "manager" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => start(() => resetMyDemo())}
        >
          <RotateCcw /> Reset my demo
        </Button>
      )}
    </div>
  );
}
