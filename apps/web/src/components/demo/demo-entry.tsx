"use client";

import { Eye, Loader2, PencilRuler } from "lucide-react";
import { useTransition } from "react";
import { type DemoMode, enterDemo } from "@/app/demo-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Entry point of the public demo: no account, two ways in. */
export function DemoEntry() {
  const [pending, start] = useTransition();
  const go = (mode: DemoMode) => start(() => enterDemo(mode));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try the demo</CardTitle>
        <CardDescription>
          No account needed. A fictional hotel with 28 employees, rules, leave
          and an hour bank. As a manager you work on your own drafts: nothing
          you do affects other visitors.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button disabled={pending} onClick={() => go("manager")}>
          {pending ? <Loader2 className="animate-spin" /> : <PencilRuler />}
          Explore as a manager
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => go("viewer")}
        >
          <Eye /> Explore read-only
        </Button>
      </CardContent>
    </Card>
  );
}
