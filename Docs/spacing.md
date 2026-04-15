Perfect — spacing is actually what will make your product feel premium vs average.
Here’s your complete spacing.md — clean, systematic, and ready to use 👇

📄 spacing.md
🧠 Spacing System
The spacing system is designed to create:
Clarity
Breathing room
Consistency
Visual hierarchy

Inspired by:
Claude (air, calm)
Linear (precision)
Notion (structure)

📏 1. Spacing Scale
We use a 4px base scale.
Core scale
4px   → xs
8px   → sm
12px  → md
16px  → lg
24px  → xl
32px  → 2xl
48px  → 3xl
64px  → 4xl


Tailwind mapping
1  → 4px
2  → 8px
3  → 12px
4  → 16px
6  → 24px
8  → 32px
12 → 48px
16 → 64px


🧩 2. Spacing Principles

1. Air > Density
More space = more premium
Less space = more clutter


2. Consistency over creativity
Always use defined scale
Never invent spacing values


3. Group related elements
Small spacing inside
Large spacing between groups


4. Visual rhythm
Repeat spacing patterns across UI


🧱 3. Layout Spacing

Page padding
<div className="px-6 py-6 md:px-8 md:py-8">

Desktop → 32px
Mobile → 24px


Section spacing
<div className="space-y-8">

Between sections → 32px


Container max width
<div className="max-w-[1600px] mx-auto">


🧩 4. Component Spacing

Cards
<div className="p-6 rounded-2xl">

Padding → 24px
Gap inside → 12–16px


Small cards / panels
<div className="p-4">

Padding → 16px


Buttons
<button className="px-4 py-2">

Horizontal → 16px
Vertical → 8px


Inputs
<input className="px-4 py-3">

Comfortable input height


💬 5. Chat UI Spacing (VERY IMPORTANT)

Chat container
<div className="space-y-5">

Between messages → 20px


Message block
<div className="p-5 rounded-2xl">

Padding → 20px


Inside message
<div className="space-y-3">

Text spacing → 12px


Actions (buttons)
<div className="gap-2">

Between buttons → 8px


🧠 6. Context Panel Spacing

Panel padding
<div className="p-5">

Padding → 20px


Between items
<div className="space-y-3">

Spacing → 12px


Section spacing
<div className="space-y-5">

Spacing → 20px


🧾 7. Text Spacing

Paragraph spacing
<p className="mb-4">

Paragraph gap → 16px


Heading spacing
<h2 className="mb-3">

Heading to content → 12px


🎯 8. Real UI Example

Card example
<div className="p-6 space-y-4 rounded-2xl border">
  <h3 className="heading-md">Hooks</h3>

  <div className="space-y-3">
    <div className="p-4 border rounded-xl">
      Hook 1
    </div>

    <div className="p-4 border rounded-xl">
      Hook 2
    </div>
  </div>
</div>


🧠 9. Spacing Hierarchy

Micro spacing
4–8px → icons, inline elements


Component spacing
12–16px → inside components


Section spacing
24–32px → between sections


Page spacing
48–64px → major layout spacing


⚠️ 10. Common Mistakes

❌ Too tight
Feels cheap
Hard to read


❌ Too loose
Feels empty
Disconnected


❌ Random values
mt-[18px] ❌
gap-[22px] ❌


✅ Always use scale

✨ 11. Advanced Guidelines

Use space instead of borders
Spacing > Dividers


Use grouping
Cluster related elements tightly
Separate groups clearly


Create rhythm
Repeat:
16px → 24px → 32px


🧾 Final Summary

Spacing System

Base:
4px scale

Sizes:
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

Principles:
- Air > density
- Consistency
- Grouping
- Rhythm

Usage:
- 12–16px → inside components
- 24px → cards
- 32px → sections
- 48px+ → page layout


🚀 Final Insight
Spacing is what will make your product feel:
Premium
Calm
Intentional

More than colors. More than fonts.

