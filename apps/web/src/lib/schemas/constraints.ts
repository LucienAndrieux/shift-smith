import { z } from "zod";
import { uuid } from "./common";

/** The text gives its own dates: a note without any is refused when parsed. */
export const constraintFormSchema = z.object({
  rawText: z.string().trim().min(5, "Describe the constraint").max(2000),
});

/**
 * Approval: where forced shifts go — a new draft copied from the published
 * version, or an existing version of the month (null = its latest draft).
 */
export const approveConstraintSchema = z.object({
  id: uuid,
  placement: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("new") }),
      z.object({ kind: z.literal("version"), scheduleId: uuid }),
    ])
    .nullable(),
});
