🧠 Component System
The component system is designed to be:
Minimal
Consistent
Structured
Calm


Core principle
Components should feel invisible, not decorative


🧱 1. Cards
Cards are the foundation of your UI.

Default card
<div className="rounded-2xl border bg-card p-6 shadow-soft">
  ...
</div>


Specs
Radius → 16px
Padding → 24px
Gap → 12–16px
Border → subtle
Shadow → very soft


Usage
creative blocks
ICP cards
competitor insights
panels

Muted card (secondary / context)
<div className="rounded-2xl border bg-secondary-soft p-5">
  ...
</div>


👉 Used for:
context panel
summaries
supporting info

🔘 2. Buttons

Primary button (ACTION)
<button className="btn-primary">
  Generate ad
</button>

.btn-primary {
  @apply inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover;
}


Secondary button
<button className="btn-secondary">
  Cancel
</button>

.btn-secondary {
  @apply inline-flex items-center justify-center rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary-soft;
}


Ghost button
<button className="btn-ghost">
  Improve
</button>

.btn-ghost {
  @apply px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground;
}


Rules
Primary → only for main action
Secondary → alternative action
Ghost → inline / subtle actions


🧾 3. Inputs

Default input
<input className="input" placeholder="Search..." />

.input {
  @apply w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition;
}
.input:focus {
  @apply ring-2 ring-primary;
}


Textarea (chat)
<textarea className="textarea" />

.textarea {
  @apply w-full resize-none rounded-2xl border bg-background px-4 py-3 text-sm outline-none;
}


Rules
Soft borders
Rounded corners
Focus = orange ring
No heavy outlines


🏷️ 4. Tags / Badges

Default tag (sage)
<span className="tag">
  Problem-aware
</span>

.tag {
  @apply rounded-full bg-secondary-soft px-3 py-1 text-xs text-secondary-dark;
}


Highlight tag (orange)
<span className="tag-primary">
  High confidence
</span>

.tag-primary {
  @apply rounded-full bg-primary-soft px-3 py-1 text-xs text-primary;
}


Usage
ICP attributes
angles
awareness levels
status indicators

💬 5. Chat Components
This is your core product experience

Chat container
<div className="space-y-5">
  ...
</div>


Message block
<div className="rounded-2xl bg-muted p-5">
  ...
</div>


Structured block (important)
<div className="rounded-2xl border bg-card p-5 space-y-3">
  <h3 className="heading-md">Hooks</h3>
  ...
</div>


Action buttons
<div className="flex gap-2">
  <button className="btn-ghost">Improve</button>
  <button className="btn-primary">Use this</button>
</div>


Rules
No chat bubbles
Flat layout
Structured blocks
Spacing > borders


🧠 6. Context Panel

Container
<div className="bg-secondary-soft p-5 rounded-2xl space-y-4">
  ...
</div>


Item
<div className="bg-card border rounded-xl p-4">
  <div className="text-xs text-muted-foreground">Product</div>
  <div className="text-sm font-medium">Portable Blender</div>
</div>


Rules
Compact
Clear hierarchy
Muted background


🧾 7. Lists

Vertical list
<div className="space-y-3">
  <div className="p-4 border rounded-xl">Item</div>
</div>


Rules
Use spacing, not separators
Keep items clean


🧠 8. Layout Components

App shell
<div className="min-h-screen bg-background">
  ...
</div>


Main container
<div className="max-w-[1600px] mx-auto px-6 py-6">
  ...
</div>


Grid layout
<div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">


👉 Used in:
Creative Studio

✨ 9. States

Hover
Subtle color change
Never aggressive


Active
Primary color or filled state


Disabled
Lower opacity
No shadow


⚠️ 10. Common Mistakes

❌ Too many styles
Keep components consistent


❌ Over-decorating
No heavy shadows
No gradients everywhere


❌ Inconsistent spacing
Breaks visual rhythm


🧾 Final Summary

Component System

Cards:
Rounded, soft, minimal

Buttons:
Primary (orange)
Secondary (neutral)
Ghost (subtle)

Inputs:
Soft, rounded, clean focus

Tags:
Sage (default)
Orange (highlight)

Chat:
Structured, not conversational UI

Layout:
Spacious, calm, clear hierarchy


🚀 Final Insight
If done right, your UI will feel:
Effortless
Focused
Premium


