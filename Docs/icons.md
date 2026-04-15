🧠 Icon System
Icons support the interface by:
Clarifying actions
Improving scanability
Reducing cognitive load

Core principle
Icons should support text, not replace it

🎯 1. Icon Style

Library
lucide-react

Why
Consistent
Minimal
Modern
Lightweight
Works perfectly with Tailwind

Style characteristics
Thin strokes
Outlined (not filled)
Simple geometry
No visual noise

Avoid
Filled icons
3D icons
Emoji-style icons
Mixed icon sets

📏 2. Icon Sizes

Standard sizes
Small → 14px
Default → 16px
Large → 20px

Tailwind usage
<h1 className="flex items-center gap-2">
 <Icon className="w-4 h-4" />
</h1>

Rules
16px → default UI
20px → emphasis (headers, actions)
14px → inline / dense UI

🎨 3. Colors

Default
text-muted-foreground

Active
text-foreground

Primary action
text-primary

Disabled
opacity-50

Rule
Icons should not draw attention unless interactive

🧩 4. Usage Guidelines

Navigation
<Home className="w-4 h-4" />
<span>Dashboard</span>

Buttons
<button className="btn-primary flex items-center gap-2">
 <Plus className="w-4 h-4" />
 New creative
</button>

Inputs
<div className="flex items-center gap-2">
 <Search className="w-4 h-4 text-muted-foreground" />
 <input ... />
</div>

Tags / inline
<span className="flex items-center gap-1">
 <Clock className="w-3.5 h-3.5" />
 2h ago
</span>

🧠 5. Interaction Behavior

Hover
Subtle color shift

Click
Instant feedback via parent component

Rule
Icons do not animate independently

🧭 6. Meaning Consistency

Important mappings
Plus → Create / Add
ArrowRight → Continue / Next
ChevronDown → Expand
Check → Success / Selected
X → Close / Remove
Clock → Time / history
Sparkles → AI / generation

Rule
Same icon = same meaning everywhere

🧱 7. Placement Rules

Spacing
Icon + text gap → 8px

Alignment
Always vertically centered

Button alignment
flex items-center gap-2

⚠️ 8. Common Mistakes

❌ Icon-only buttons (avoid)
Always add label unless obvious (e.g. close)

❌ Mixing styles
Lucide + random icons ❌

❌ Overusing icons
Not every element needs an icon

❌ Large icons
Breaks visual balance

✨ 9. When NOT to use icons

Long text sections
Chat messages
Paragraphs
Complex content

👉 Keep UI clean and calm

🧾 10. Summary

Icon System

Library:
lucide-react

Style:
Minimal, outlined, thin

Sizes:
14 / 16 / 20

Colors:
Muted by default
Primary only for actions

Usage:
Support text, not replace it

Rule:
Consistency over creativity

🧠 Final Insight
Icons are not decoration

They are small pieces of language

