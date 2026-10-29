import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentYearMonth } from "@/lib/dates";
import { requireUser } from "@/server/session";

export default async function HoursIndex() {
  await requireUser();
  await connection();
  const { year, month } = currentYearMonth();
  redirect(`/hours/${year}/${month}`);
}
