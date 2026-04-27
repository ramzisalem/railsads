"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/lib/auth/actions";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await signUp(formData);
    },
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="heading-lg">Create your account</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Meet your AI ads creative strategist
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="signup-name" className="text-xs text-muted-foreground">Full name</label>
            <input
              id="signup-name"
              name="fullName"
              className="input-field mt-1"
              type="text"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="text-xs text-muted-foreground">Email</label>
            <input
              id="signup-email"
              name="email"
              className="input-field mt-1"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="text-xs text-muted-foreground">Password</label>
            <input
              id="signup-password"
              name="password"
              className="input-field mt-1"
              type="password"
              placeholder="Create a password (min 6 characters)"
              minLength={6}
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={isPending}>
            {isPending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-small text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
