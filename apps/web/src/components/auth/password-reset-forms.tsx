"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { TextField } from "@/components/form/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import {
  forgotPasswordSchema,
  PASSWORD_MIN,
  resetPasswordSchema,
} from "@/lib/schemas/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: z.infer<typeof forgotPasswordSchema>) {
    await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Same message whether or not the address exists.
    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          We will email you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Alert>
            <AlertDescription>
              If an account exists for this address, a reset link is on its way.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <TextField
                control={form.control}
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Send reset link
              </Button>
            </FieldGroup>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link
            href="/sign-in"
            className="text-muted-foreground hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(
    params.get("error") ? "This reset link is invalid or has expired." : null,
  );
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit({ password }: z.infer<typeof resetPasswordSchema>) {
    if (!token) return;
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (error) {
      setError(error.message ?? "Could not reset the password");
      return;
    }
    router.replace("/sign-in");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {(error || !token) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error ?? "Missing reset token."}
                </AlertDescription>
              </Alert>
            )}
            <TextField
              control={form.control}
              name="password"
              label="New password"
              type="password"
              autoComplete="new-password"
              description={`At least ${PASSWORD_MIN} characters.`}
            />
            <TextField
              control={form.control}
              name="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
            />
            <Button
              type="submit"
              disabled={!token || form.formState.isSubmitting}
            >
              Save password
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
