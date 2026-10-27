import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { type CurrentUser, requireAdmin, requirePlanner } from "./session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Thrown inside an action to return a user-facing error. */
export class ActionError extends Error {}

/**
 * Wraps an admin mutation: checks the session server-side, validates the input with
 * the shared Zod schema, runs the handler, refreshes the client router and turns
 * errors into a typed result. Handlers are responsible for writing the audit log.
 */
export function adminAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  /** Read-only actions (polling, previews) skip the router refresh. */
  options: { refreshOnSuccess?: boolean } = {},
) {
  return guardedAction(requireAdmin, schema, handler, options);
}

/**
 * Same as adminAction for planning actions open to demo managers too. Handlers must
 * restrict demo managers to their own drafts (loadEditableSchedule does).
 */
export function plannerAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  options: { refreshOnSuccess?: boolean } = {},
) {
  return guardedAction(requirePlanner, schema, handler, options);
}

function guardedAction<S extends z.ZodType, T>(
  requireUser: () => Promise<CurrentUser>,
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  options: { refreshOnSuccess?: boolean },
) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    const user = await requireUser();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Some fields are invalid.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }
    try {
      const data = await handler(parsed.data, user);
      if (options.refreshOnSuccess !== false) refresh();
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ActionError)
        return { ok: false, error: error.message };
      const message = describeDbError(error);
      if (message) return { ok: false, error: message };
      throw error;
    }
  };
}

/** Friendly messages for common Postgres constraint errors. */
function describeDbError(error: unknown): string | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const code = (cause as { code?: string })?.code;
  const constraint = (cause as { constraint_name?: string })?.constraint_name;
  if (code === "23505")
    return `This already exists (${constraint ?? "unique"}).`;
  if (code === "23503")
    return `This is still referenced elsewhere (${constraint ?? "foreign key"}).`;
  if (code === "23514")
    return `A constraint was violated (${constraint ?? "check"}).`;
  return null;
}
