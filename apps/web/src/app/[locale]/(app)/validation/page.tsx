import type { Metadata } from "next";
import { connection } from "next/server";
import { currentYearMonth } from "@/lib/dates";
import { getLocale, getT } from "@/lib/i18n/server";
import { getUpcomingValidationTargets } from "@/server/queries/validation";
import { isManager, requireUser } from "@/server/session";
import { UpcomingValidation } from "./upcoming-validation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.validation };
}

/**
 * Errors and warnings of the current month and the following ones, each month
 * checked on the user's latest editable draft, otherwise its published version.
 */
export default async function ValidationIndex() {
  const user = await requireUser();
  await connection();
  const targets = await getUpcomingValidationTargets(
    user,
    currentYearMonth(),
    await getLocale(),
  );
  return <UpcomingValidation targets={targets} canPlan={isManager(user)} />;
}
