import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { DemoEntry } from "@/components/demo/demo-entry";

export const metadata: Metadata = { title: "Log in" };

// DEMO_MODE is read at build time for this static page: rebuild after changing it.
const demoMode = process.env.DEMO_MODE === "true";

export default function Page() {
  return demoMode ? (
    <div className="flex flex-col gap-4">
      <DemoEntry />
      <SignInForm title="Administrator" allowRegister={false} />
    </div>
  ) : (
    <SignInForm />
  );
}
