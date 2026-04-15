"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { error?: string; success?: string } | null,
      formData: FormData
    ) => {
      return await resetPassword(formData);
    },
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="heading-lg">Reset password</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="rounded-xl bg-success/10 p-3 text-sm text-success">
              {state.success}
            </div>
          )}

          <div>
            <label htmlFor="reset-email" className="text-xs text-muted-foreground">Email</label>
            <input
              id="reset-email"
              name="email"
              className="input-field mt-1"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={isPending}>
            {isPending ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-small text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
