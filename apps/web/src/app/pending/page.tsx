import { Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Access pending" };

export default function PendingPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <PendingCard />
      </Suspense>
    </main>
  );
}

async function PendingCard() {
  const user = await requireUser();
  if (user.accessStatus === "approved") redirect("/");
  const rejected = user.accessStatus === "rejected";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {rejected ? (
            <XCircle className="size-5 text-destructive" />
          ) : (
            <Clock className="size-5" />
          )}
          {rejected ? "Access request declined" : "Access pending"}
        </CardTitle>
        <CardDescription>
          {rejected
            ? "An administrator declined your access request. Contact the hotel if you think this is a mistake."
            : "Your access request is awaiting approval. You will receive an email once an administrator has reviewed it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{user.email}</span>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
