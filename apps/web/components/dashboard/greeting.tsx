"use client";

import { useLayoutEffect, useState } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Shown on SSR and first paint so HTML matches hydration; replaced immediately with local-time greeting. */
const SERVER_FALLBACK = "Welcome back";

interface GreetingProps {
  firstName: string | null;
  brandName: string;
}

export function Greeting({ firstName, brandName }: GreetingProps) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useLayoutEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const phrase = greeting ?? SERVER_FALLBACK;
  const title = firstName ? `${phrase}, ${firstName}` : phrase;

  return (
    <div>
      <h1 className="heading-xl">{title}</h1>
      <p className="mt-1 text-body text-muted-foreground">
        Here&apos;s what&apos;s happening with {brandName}
      </p>
    </div>
  );
}
