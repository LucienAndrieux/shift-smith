import { z } from "zod";

export const constraintFormSchema = z.object({
  rawText: z.string().trim().min(5, "Describe the constraint").max(2000),
  /** Target month as YYYY-MM. */
  target: z.string().regex(/^\d{4}-\d{2}$/, "Choose a month"),
});
