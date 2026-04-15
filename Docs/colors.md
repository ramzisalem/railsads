Color System
🟤 Light Theme (Beige + Sage Accent)
Base
Background: #F5F3EF
Surface:    #FFFFFF
Border:     #E7E5E4


Text
Primary:   #1C1C1C
Secondary: #6B6B6B
Muted:     #9A9A9A


🔶 Primary Accent (Energy — Ads)
Keep your orange:
Primary Accent: #FF6A00
Hover:          #FF8126
Soft:           rgba(255,106,0,0.1)


🌿 Secondary Accent (NEW — from your image)
Approx extracted tone:
Sage Primary: #9FB5AE
Sage Dark:    #7F9992
Sage Soft:    rgba(159,181,174,0.15)


🧠 When to use each
This is important 👇

🔶 Orange = ACTION
Use for:
primary buttons
CTAs
active states
highlights
👉 “Do something”

🌿 Sage = CALM / STRUCTURE
Use for:
backgrounds (cards, panels)
secondary highlights
tags / labels
subtle UI elements
👉 “Context / support / intelligence”

🌙 Dark Theme (Updated)

Base
Background: #0F0F10
Surface:    #18181B
Elevated:   #1F1F23
Border:     #2A2A2E


Text
Primary:   #FFFFFF
Secondary: #A1A1AA
Muted:     #71717A


🔶 Orange Accent
Primary: #FF6A00
Hover:   #FF8126
Soft:    rgba(255,106,0,0.15)


🌿 Sage Accent (Dark Mode Adapted)
Slightly desaturated for dark:
Sage Primary: #8FA8A1
Sage Dark:    #6E8780
Sage Soft:    rgba(143,168,161,0.12)


🧠 Why this combo is VERY strong

You now have 3 layers:
1. Beige / Dark neutral
→ calm, Claude-like base
2. Orange
→ energy, ads, action
3. Sage
→ intelligence, structure, calm contrast

👉 This creates a very unique identity
Most tools only have:
1 accent ❌

You now have:
Primary (action) + Secondary (calm intelligence) ✅


🧩 Practical UI usage examples

Creative Studio
Chat → neutral
Context panel → light sage background
CTA button → orange

ICP cards
background → white
subtle sage border or tag

Competitor insights
use sage for:
pattern tags
insight highlights

Templates
selected → orange
hover → sage tint

🎯 Tailwind Naming (IMPORTANT)

Use semantic names:
colors: {
  background: "#F5F3EF",
  surface: "#FFFFFF",
  
  primary: "#FF6A00",
  primaryHover: "#FF8126",
  
  secondary: "#9FB5AE",
  secondaryDark: "#7F9992",
  secondarySoft: "rgba(159,181,174,0.15)",
  
  textPrimary: "#1C1C1C",
  textSecondary: "#6B6B6B",
}


👉 Don’t name them:
orange500 ❌
green300 ❌

👉 Use:
primary / secondary ✅


🔥 Final Visual Identity

Typography:
Serif headings (Playfair)
Sans body (Inter)

Colors:
Beige (light) / Dark neutral (dark)
Orange = action
Sage = calm intelligence

Feeling:
Claude calm
+ Creative energy
+ Structured SaaS





Here’s a ready-to-paste Tailwind setup for your product style system using:
Playfair Display for headings
Inter for body/UI
Claude-like beige light mode
dark neutral dark mode
orange primary accent
sage secondary accent
Tailwind supports extending theme tokens like colors, fonts, spacing, radii, and shadows in your config, and Next.js recommends next/font for optimized self-hosted Google fonts with CSS variables. (v3.tailwindcss.com)
1. tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "ui-serif", "Georgia", "serif"],
      },

      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",

        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          soft: "hsl(var(--primary-soft))",
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          dark: "hsl(var(--secondary-dark))",
          soft: "hsl(var(--secondary-soft))",
        },

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },

        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        studio: {
          beige: "#F5F3EF",
          surface: "#FFFFFF",
          text: "#1C1C1C",
          textSecondary: "#6B6B6B",
          textMuted: "#9A9A9A",
          orange: "#FF6A00",
          orangeHover: "#FF8126",
          sage: "#9FB5AE",
          sageDark: "#7F9992",
        },

        studioDark: {
          background: "#0F0F10",
          surface: "#18181B",
          elevated: "#1F1F23",
          border: "#2A2A2E",
          text: "#FFFFFF",
          textSecondary: "#A1A1AA",
          textMuted: "#71717A",
          orange: "#FF6A00",
          orangeHover: "#FF8126",
          sage: "#8FA8A1",
          sageDark: "#6E8780",
        },
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },

      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)",
        panel: "0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px rgba(16, 24, 40, 0.08)",
      },

      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },

      maxWidth: {
        studio: "1600px",
      },
    },
  },
  plugins: [],
};

export default config;

2. app/fonts.ts
import { Inter, Playfair_Display } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

3. app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { inter, playfair } from "./fonts";

export const metadata: Metadata = {
  title: "Your App",
  description: "AI ad workspace for ecommerce brands",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

4. app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Claude-like warm light theme */
    --background: 36 23% 95%;          /* #F5F3EF */
    --foreground: 0 0% 11%;            /* #1C1C1C */

    --card: 0 0% 100%;                 /* #FFFFFF */
    --card-foreground: 0 0% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 11%;

    --border: 24 8% 90%;               /* #E7E5E4-ish */
    --input: 24 8% 90%;
    --ring: 25 100% 50%;               /* orange */

    /* Primary = action */
    --primary: 25 100% 50%;            /* #FF6A00 */
    --primary-foreground: 0 0% 100%;
    --primary-hover: 25 100% 57%;      /* #FF8126 */
    --primary-soft: 25 100% 50% / 0.10;

    /* Secondary = calm sage */
    --secondary: 158 15% 67%;          /* #9FB5AE */
    --secondary-foreground: 160 13% 28%;
    --secondary-dark: 160 11% 55%;     /* #7F9992 */
    --secondary-soft: 158 15% 67% / 0.15;

    --muted: 36 18% 92%;
    --muted-foreground: 0 0% 42%;      /* #6B6B6B */

    --accent: 158 15% 67%;
    --accent-foreground: 160 13% 28%;

    --success: 142 71% 45%;
    --success-foreground: 0 0% 100%;

    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 11%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
  }

  .dark {
    /* Dark theme */
    --background: 240 5% 6%;           /* #0F0F10 */
    --foreground: 0 0% 100%;

    --card: 240 5% 10%;                /* #18181B */
    --card-foreground: 0 0% 100%;

    --popover: 240 5% 10%;
    --popover-foreground: 0 0% 100%;

    --border: 240 4% 17%;              /* #2A2A2E */
    --input: 240 4% 17%;
    --ring: 25 100% 50%;

    --primary: 25 100% 50%;            /* #FF6A00 */
    --primary-foreground: 0 0% 100%;
    --primary-hover: 25 100% 57%;      /* #FF8126 */
    --primary-soft: 25 100% 50% / 0.15;

    --secondary: 157 12% 61%;          /* #8FA8A1 */
    --secondary-foreground: 156 12% 88%;
    --secondary-dark: 157 10% 48%;     /* #6E8780 */
    --secondary-soft: 157 12% 61% / 0.12;

    --muted: 240 5% 14%;               /* subtle panel */
    --muted-foreground: 240 5% 65%;    /* #A1A1AA */

    --accent: 157 12% 61%;
    --accent-foreground: 156 12% 88%;

    --success: 142 71% 45%;
    --success-foreground: 0 0% 100%;

    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 11%;

    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 100%;
  }

  * {
    @apply border-border;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }

  h1, h2, h3, h4, .font-heading {
    @apply font-serif tracking-tight;
  }
}

5. Recommended utility usage
Use these patterns consistently:
<h1 className="font-serif text-4xl md:text-5xl tracking-tight">
  Creative Studio
</h1>

<div className="bg-card text-card-foreground border rounded-2xl shadow-soft p-6">
  ...
</div>

<button className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl px-4 py-2">
  Generate ad
</button>

<div className="bg-secondary-soft text-secondary-dark rounded-full px-3 py-1 text-xs">
  Problem-aware
</div>

6. Optional: helper classes in globals.css
@layer components {
  .app-shell {
    @apply min-h-screen bg-background text-foreground;
  }

  .panel {
    @apply rounded-2xl border bg-card text-card-foreground shadow-soft;
  }

  .panel-muted {
    @apply rounded-2xl border bg-secondary-soft text-foreground;
  }

  .heading-xl {
    @apply font-serif text-4xl tracking-tight md:text-5xl;
  }

  .heading-lg {
    @apply font-serif text-3xl tracking-tight;
  }

  .heading-md {
    @apply font-serif text-2xl tracking-tight;
  }

  .text-ui {
    @apply text-sm text-muted-foreground;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover;
  }

  .btn-secondary {
    @apply inline-flex items-center justify-center rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary-soft;
  }
}


