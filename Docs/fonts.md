🧠 Typography System
This product uses a dual-font system to balance:
Editorial elegance (serif)
UI clarity (sans-serif)
The goal is to create a UI that feels:
Premium
Calm
Readable
Modern
Intentional

🅰️ Font Stack
Primary Fonts
Headings → Playfair Display (serif)
Body/UI → Inter (sans-serif)

Why this pairing
Playfair Display
High contrast → premium feel
Editorial style → strong identity
Best for headings and emphasis
Inter
Designed for UI
Highly readable at small sizes
Neutral and modern

⚙️ Implementation
Next.js font setup
app/fonts.ts
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

app/layout.tsx
<html lang="en" className={`${inter.variable} ${playfair.variable}`}>
 <body className="font-sans antialiased">
   {children}
 </body>
</html>

Tailwind configuration
fontFamily: {
 sans: ["var(--font-inter)", "system-ui", "sans-serif"],
 serif: ["var(--font-playfair)", "Georgia", "serif"],
},

🎨 Typography Scale
Headings (Serif)
.heading-xl {
 @apply font-serif text-[36px] md:text-[40px] leading-[1.1] tracking-[-0.02em];
}

.heading-lg {
 @apply font-serif text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.015em];
}

.heading-md {
 @apply font-serif text-[22px] md:text-[24px] leading-[1.2] tracking-[-0.01em];
}

Body (Sans)
.text-body {
 @apply font-sans text-[15px] leading-[1.6];
}

.text-body-lg {
 @apply font-sans text-[16px] leading-[1.6];
}

UI Text
.text-ui {
 @apply font-sans text-[14px] leading-[1.4];
}

.text-small {
 @apply font-sans text-[13px] leading-[1.4];
}

.text-xs {
 @apply font-sans text-[12px] leading-[1.3] tracking-[0.02em];
}

🧩 Usage Guidelines
Headings
heading-xl → Page titles
heading-lg → Section titles
heading-md → Card titles

Body
text-body → Main content, ad copy
text-body-lg → Important content (hero, highlights)

UI
text-ui → Buttons, inputs, labels
text-small → Metadata (timestamps, helper text)
text-xs → Tags, badges, captions

🎯 Examples
Page Title
<h1 className="heading-xl">
 Creative Studio
</h1>

Section Title
<h2 className="heading-lg">
 Active Creative
</h2>

Card Title
<h3 className="heading-md">
 Hooks
</h3>

Body Text
<p className="text-body">
 Stop wasting time making smoothies the old way.
</p>

Button
<button className="text-ui">
 Generate ad
</button>

Tag
<span className="text-xs">
 Problem-aware
</span>

🧠 Core Rules
1. Serif is for hierarchy only
✅ Use serif for:
Headings
Titles
Key highlights
❌ Do NOT use serif for:
Chat messages
Buttons
Inputs
Long paragraphs

2. Sans-serif for everything functional
UI = Inter only

3. Do not introduce random sizes
❌ Avoid:
text-[17px]
text-[19px]
✅ Stick to the defined scale

4. Line height rules
1.1 → Headlines
1.2 → Sub-headings
1.6 → Body text

5. Limit font weights
Use only:
400 → Normal
500 → Medium (UI emphasis)
600 → Optional (headings)
Avoid excessive weights.

✨ Advanced Guidelines (Optional)
Letter spacing
.heading-xl {
 letter-spacing: -0.02em;
}

.heading-lg {
 letter-spacing: -0.015em;
}

Optimal reading width
.prose {
 max-width: 65ch;
}

🧾 Summary
Typography System

Fonts:
- Playfair Display (headings)
- Inter (body/UI)

Scale:
- 36–40px → H1
- 28–32px → H2
- 22–24px → H3
- 15–16px → Body
- 12–14px → UI

Principles:
- Serif for hierarchy
- Sans for readability
- Consistent scale
- Strong spacing

