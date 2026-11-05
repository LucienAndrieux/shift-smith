import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getRequestT } from "@/lib/i18n/server";
import { invalidateValidationCounts } from "@/server/validation-cache";
import { type CurrentUser, requireManager, requireUser } from "./session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Thrown inside an action to return a user-facing error: a text picked from the
 * visitor's dictionary (`(t) => t.errors.…`), or a plain string.
 */
export class ActionError extends Error {
  constructor(readonly text: string | ((t: Dictionary) => string)) {
    super(typeof text === "string" ? text : "ActionError");
  }
}

/**
 * Wraps a manager mutation: checks the session server-side, validates the input
 * with the shared Zod schema, runs the handler, refreshes the client router and
 * turns errors into a typed result. Handlers are responsible for writing the audit
 * log.
 */
export function managerAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  /** Read-only actions (polling, previews) skip the router refresh. */
  options: { refreshOnSuccess?: boolean } = {},
) {
  return guardedAction(requireManager, schema, handler, options);
}

/**
 * Same as managerAction for actions open to every visitor; the handler checks what
 * the role allows (employees submitting their requests, read-only previews).
 */
export function userAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  options: { refreshOnSuccess?: boolean } = {},
) {
  return guardedAction(requireUser, schema, handler, options);
}

function guardedAction<S extends z.ZodType, T>(
  requireRole: () => Promise<CurrentUser>,
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
  options: { refreshOnSuccess?: boolean },
) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    const user = await requireRole();
    const t = await getRequestT();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: t.common.invalidFields,
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }
    try {
      const data = await handler(parsed.data, user);
      if (options.refreshOnSuccess !== false) {
        // A write: the cached sidebar counts may be out of date.
        invalidateValidationCounts();
        refresh();
      }
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ActionError)
        return {
          ok: false,
          error: typeof error.text === "string" ? error.text : error.text(t),
        };
      const message = describeDbError(error, t);
      if (message) return { ok: false, error: message };
      throw error;
    }
  };
}

/** Friendly messages for common Postgres constraint errors. */
function describeDbError(error: unknown, t: Dictionary): string | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const code = (cause as { code?: string })?.code;
  const constraint = (cause as { constraint_name?: string })?.constraint_name;
  if (code === "23505") return t.common.alreadyExists(constraint ?? "unique");
  if (code === "23503")
    return t.common.stillReferenced(constraint ?? "foreign key");
  if (code === "23514")
    return t.common.constraintViolated(constraint ?? "check");
  return null;
}
