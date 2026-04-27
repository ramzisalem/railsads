"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth/actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const callbackError = searchParams.get("error");

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await signIn(formData);
    },
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirect" value={redirectTo} />

      {callbackError && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Authentication failed. Please try again.
        </div>
      )}
      {state?.error && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="text-xs text-muted-foreground">Email</label>
        <input
          id="login-email"
          name="email"
          className="input-field mt-1"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className="text-xs text-muted-foreground">Password</label>
        <input
          id="login-password"
          name="password"
          className="input-field mt-1"
          type="password"
          placeholder="Your password"
          required
        />
      </div>
      <button className="btn-primary w-full" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="heading-lg">Welcome back</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <div className="space-y-2 text-center">
          <Link
            href="/forgot-password"
            className="text-small text-muted-foreground hover:text-foreground"
          >
            Forgot your password?
          </Link>
          <p className="text-small text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
