import type { Database } from "@/db";
import { auditLog } from "@/db/schema";

type Executor = Pick<Database, "insert">;

export interface AuditEntry {
  userId: string | null;
  action: "create" | "update" | "delete" | (string & {});
  entity: string;
  entityId?: string | null;
  diff?: unknown;
}

/** Records a manager mutation. Pass the transaction to keep it atomic with the change. */
export async function audit(executor: Executor, entry: AuditEntry) {
  await executor.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    diff: entry.diff === undefined ? null : toJson(entry.diff),
  });
}

/** Before/after diff limited to the keys that changed. */
export function changes<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(toJson(from)) !== JSON.stringify(toJson(to))) {
      diff[key] = { from: toJson(from), to: toJson(to) };
    }
  }
  return diff;
}

function toJson(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
