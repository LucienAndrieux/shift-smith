"use client";

import { Eye, Loader2, PencilRuler, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { enterDemo } from "@/app/demo-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/server/session";

/** Start page of the showcase: no account, three roles to pick from. */
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
  const spinner = (role: Role) =>
    pending && chosen === role ? <Loader2 className="animate-spin" /> : null;
  const sections = [...new Set(employees.map((e) => e.section))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try the demo</CardTitle>
        <CardDescription>
          No account needed: a fictional hotel with 28 employees, rules, leave
          and an hour bank. The demo data is restored every night at 03:00.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Button disabled={pending} onClick={() => go("manager")}>
            {spinner("manager") ?? <PencilRuler />} Manager
          </Button>
          <p className="text-xs text-muted-foreground">
            Every right: plan, generate, fix, publish, edit the reference data
            and approve requests. Other visitors see your changes.
          </p>
        </div>
        <Separator />
        <div className="flex flex-col gap-1.5">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-full" aria-label="Employee to play">
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
            variant="secondary"
            disabled={pending || !employeeId}
            onClick={() => go("employee")}
          >
            {spinner("employee") ?? <UserRound />} Employee
          </Button>
          <p className="text-xs text-muted-foreground">
            Play one employee: your schedule, hours and absences, and requests
            sent to the managers.
          </p>
        </div>
        <Separator />
        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => go("viewer")}
          >
            {spinner("viewer") ?? <Eye />} Read-only
          </Button>
          <p className="text-xs text-muted-foreground">
            Browse the published schedules and the reference data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
