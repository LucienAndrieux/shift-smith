import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentYearMonth } from "@/lib/dates";
import { requireApprovedUser } from "@/server/session";

export default async function HoursIndex() {
  await requireApprovedUser();
  await connection();
  const { year, month } = currentYearMonth();
  redirect(`/hours/${year}/${month}`);
}
