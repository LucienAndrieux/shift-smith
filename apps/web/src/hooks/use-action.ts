"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/**
 * Runs a Server Action inside a transition and reports the outcome with a toast.
 * Returns the result so callers can react (close a dialog, map field errors…).
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options: { success?: string } = {},
  ): Promise<ActionResult<T>> {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            if (options.success)
              toast.success(result.message ?? options.success);
          } else {
            toast.error(result.error);
          }
          resolve(result);
        } catch (error) {
          console.error(error);
          toast.error("Something went wrong. Please try again.");
          resolve({ ok: false, error: "Unexpected error" });
        }
      });
    });
  }

  return { pending, run };
}
