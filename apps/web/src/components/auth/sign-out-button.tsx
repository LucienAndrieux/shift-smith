"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton(props: ComponentProps<typeof Button>) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      {...props}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut /> Log out
    </Button>
  );
}
