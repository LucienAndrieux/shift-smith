import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { schedulingRules } from "@/db/schema";
import { isRuleCode, RULE_CODES } from "@/lib/domain/rules";
import { getT } from "@/lib/i18n/server";
import { getEmployees, getSections } from "@/server/queries/reference";
import { requireUser } from "@/server/session";
import { DeleteRuleButton, RuleDialog } from "./rule-dialogs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.rules };
}

const SCOPE_ORDER = { global: 0, section: 1, employee: 2 } as const;

export default async function RulesPage() {
  const user = await requireUser();
  const t = await getT();
  const ru = t.rules;
  const canManage = user.role === "manager";
  const [rules, sections, employees] = await Promise.all([
    db.select().from(schedulingRules),
    getSections(),
    getEmployees(),
  ]);
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const employeeName = new Map(employees.map((e) => [e.id, e.displayName]));
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }));
  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: e.displayName,
  }));
  const codeOrder = (code: string) =>
    isRuleCode(code) ? RULE_CODES.indexOf(code) : RULE_CODES.length;
  const sorted = [...rules].sort(
    (a, b) =>
      codeOrder(a.code) - codeOrder(b.code) ||
      SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope],
  );

  return (
    <>
      <PageHeader
        title={t.nav.rules}
        description={ru.pageText}
        actions={
          canManage && (
            <RuleDialog sections={sectionOptions} employees={employeeOptions} />
          )
        }
      />
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ru.rule}</TableHead>
                <TableHead>{ru.appliesTo}</TableHead>
                <TableHead>{ru.value}</TableHead>
                <TableHead>{ru.type}</TableHead>
                <TableHead>{ru.description}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.isActive ? undefined : "opacity-50"}
                >
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">
                      {isRuleCode(r.code) ? ru.descriptions[r.code] : r.code}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.code}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.scope === "global"
                      ? ru.everyone
                      : r.scope === "section"
                        ? ru.sectionScope(
                            sectionName.get(r.sectionId ?? "") ?? "",
                          )
                        : ru.employeeScope(
                            employeeName.get(r.employeeId ?? "") ?? "",
                          )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {JSON.stringify(r.value)}
                  </TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      <Badge variant={r.isHard ? "default" : "secondary"}>
                        {r.isHard ? ru.hard : ru.soft}
                      </Badge>
                      {!r.isActive && (
                        <Badge variant="outline">{ru.inactive}</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                    {r.description}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <span className="flex justify-end">
                        <RuleDialog
                          initial={r}
                          sections={sectionOptions}
                          employees={employeeOptions}
                        />
                        <DeleteRuleButton
                          id={r.id}
                          global={r.scope === "global"}
                        />
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
