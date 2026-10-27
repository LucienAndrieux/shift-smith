import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return <SignInForm />;
}
