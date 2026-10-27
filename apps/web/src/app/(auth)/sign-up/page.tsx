import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Register" };

export default function Page() {
  return <SignUpForm />;
}
