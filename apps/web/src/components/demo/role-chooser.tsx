"use client";

import {
  ArrowRight,
  Eye,
  Loader2,
  type LucideIcon,
  PencilRuler,
  UserRound,
} from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { enterDemo } from "@/app/demo-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/session";

const CARD =
  "group relative flex w-full items-start gap-4 rounded-2xl border bg-card/80 p-4 text-left shadow-sm backdrop-blur transition-all";

/** The three ways into the showcase, as cards. */
export function RoleChooser({
  employees,
}: {
  employees: { id: string; name: string; section: string }[];
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Role | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const go = (role: Role) => {
    setChosen(role);
    start(async () => {
      await enterDemo(role, role === "employee" ? employeeId : undefined);
      // Full navigation, so the new session cookie is sent.
      window.location.assign("/schedule");
    });
  };
  const sections = [...new Set(employees.map((e) => e.section))];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => go("manager")}
        className={cn(
          CARD,
          "cursor-pointer hover:-translate-y-0.5 hover:border-[#E8590C]/50 hover:shadow-md disabled:pointer-events-none disabled:opacity-70",
        )}
      >
        <RoleIcon icon={PencilRuler} accent />
        <RoleText
          title="Manager"
          badge="Every right"
          text="Plan, generate, fix and publish; edit the reference data and approve requests. Other visitors see your changes."
        />
        <Go busy={pending && chosen === "manager"} />
      </button>

      <div className={cn(CARD, "flex-wrap sm:flex-nowrap")}>
        <RoleIcon icon={UserRound} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <RoleText
            title="Employee"
            text="Play one of the 28 employees: your schedule highlighted, your hours and absences, and requests sent to the managers."
          />
          <div className="flex gap-2">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger
                className="min-w-0 flex-1 bg-background"
                aria-label="Employee to play"
              >
                <SelectValue placeholder="Choose an employee…" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectGroup key={section}>
                    <SelectLabel>{section}</SelectLabel>
                    {employees
                      .filter((e) => e.section === section)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={pending || !employeeId}
              onClick={() => go("employee")}
            >
              {pending && chosen === "employee" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              Enter
            </Button>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => go("viewer")}
        className={cn(
          CARD,
          "cursor-pointer hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md disabled:pointer-events-none disabled:opacity-70",
        )}
      >
        <RoleIcon icon={Eye} />
        <RoleText
          title="Read-only"
          text="Browse the published schedules, the validation and the reference data without changing anything."
        />
        <Go busy={pending && chosen === "viewer"} />
      </button>
    </div>
  );
}

function RoleIcon({
  icon: Icon,
  accent,
}: {
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border",
        accent
          ? "border-[#E8590C]/30 bg-[#E8590C]/10 text-[#E8590C]"
          : "bg-muted text-foreground/80",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function RoleText({
  title,
  badge,
  text,
}: {
  title: string;
  badge?: string;
  text: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-center gap-2 font-semibold">
        {title}
        {badge && (
          <span className="rounded-full bg-[#E8590C]/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#E8590C] uppercase">
            {badge}
          </span>
        )}
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground">
        {text}
      </span>
    </span>
  );
}

function Go({ busy }: { busy: boolean }) {
  return (
    <span className="self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
      {busy ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <ArrowRight className="size-5" />
      )}
    </span>
  );
}
