"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";
import type { ActionResult } from "@/server/action";

/**
 * Runs a Server Action inside a transition and reports the outcome with a toast.
 * Returns the result so callers can react (close a dialog, map field errors…).
 */
export function useAction() {
  const t = useT();
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
          toast.error(t.common.unexpected);
          resolve({ ok: false, error: t.common.unexpected });
        }
      });
    });
  }

  return { pending, run };
}
