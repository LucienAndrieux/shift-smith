import type { Metadata } from "next";
import { connection } from "next/server";
import { currentYearMonth } from "@/lib/dates";
import { getUpcomingValidationTargets } from "@/server/queries/validation";
import { canPlan, requireApprovedUser } from "@/server/session";
import { UpcomingValidation } from "./upcoming-validation";

export const metadata: Metadata = { title: "Validation" };

/**
 * Errors and warnings of the current month and the following ones, each month
 * checked on the user's latest editable draft, otherwise its published version.
 */
export default async function ValidationIndex() {
  const user = await requireApprovedUser();
  await connection();
  const targets = await getUpcomingValidationTargets(user, currentYearMonth());
  return <UpcomingValidation targets={targets} canPlan={canPlan(user)} />;
}
