🧠 Product UX Patterns
This document defines how users interact with the product.
It ensures:
Consistency
Clarity
Predictability
Speed of learning

Core principle
Guide the user through structured workflows, not open-ended actions

🎯 1. Core Product Pattern
Your product is built around:
Context → Generation → Iteration → Selection → Export

Flow
1. Select context (product, ICP, template)
2. Generate creatives
3. Iterate through chat
4. Select best output
5. Export / use

👉 This pattern must be consistent everywhere

🧩 2. Creation Pattern (Main Flow)

Entry point
User selects:
- Product
- ICP
- Template (optional)

System response
Generate structured outputs:
- Hooks
- Headlines
- Primary text
- Creative direction

UI behavior
Show results in structured blocks (not raw text)
Each item has actions:
Improve
Use
Regenerate

Rule
Never show raw AI output without structure

💬 3. Iteration Pattern (CORE)
This is your strongest differentiator.

Behavior
User writes:
"make it more emotional"

System:
→ modifies current creative
→ does NOT restart from scratch

Requirements
Always keep:
current version
previous versions
Changes are incremental

UI
Chat + structured output

Rule
Iteration should feel like editing, not regenerating

🧠 4. Context Selection Pattern

Context elements
Product
ICP
Template
Angle
Awareness

Behavior
Always visible (right panel)
Editable at any time
Changes affect future outputs

Rule
Context should be visible, not hidden in prompts

🧾 5. Selection Pattern

Example
User chooses a hook:
"Use this"

Behavior
That item becomes:
active creative
Highlight it visually

UI
Selected state:
- stronger border
- subtle background

Rule
Selection must feel clear and intentional

🔁 6. Regeneration Pattern

When used
User wants new options

Behavior
Keep previous results
Add new variation set

Avoid
Replacing everything

Rule
Regeneration should expand, not erase

🧠 7. Empty State Pattern

Structure
Illustration
Title
Short explanation
Primary action

Example
No creatives yet
Select a product and generate your first ad
[Generate ad]

Rule
Always show a next action

⏳ 8. Loading Pattern

Types
Skeleton (preferred)
Streaming (AI)
Spinner (minimal)

Behavior
Show structure immediately
Fill progressively

Rule
Never show blank loading screens

⚠️ 9. Error Pattern

Behavior
Clear message
Retry option
No technical jargon

Example
Something went wrong. Try again.

Rule
Errors should not break flow

💾 10. Persistence Pattern

Threads
Each session = thread

Behavior
Auto-save everything
User can:
leave
come back
continue

Rule
Nothing should be lost

🧭 11. Navigation Pattern

Structure
Sidebar:
- Creative Studio
- Products
- Competitors
- Brand

Behavior
Persistent across pages
Context stays linked to brand

Rule
Navigation should feel stable and predictable

🧠 12. Decision Guidance Pattern

System should suggest
Best angle
Best template
Best direction

Example
Recommended: Problem → Solution

Rule
Guide decisions, don’t leave user guessing

🧩 13. Action Pattern

Types
Primary → Generate, Use
Secondary → Edit, Change
Tertiary → Improve, Try again

Rule
Always one clear primary action

⚠️ 14. Anti-Patterns (Avoid)

❌ Chat-only interface
No structure
Hard to scan

❌ One-shot generation
No iteration
No learning

❌ Hidden context
Forces user to repeat inputs

❌ Destructive actions
Losing previous outputs

🧾 15. Pattern Summary

Core Pattern:
Context → Generate → Iterate → Select → Export

Key Behaviors:
- Structured outputs
- Persistent threads
- Visible context
- Incremental iteration
- Clear selection

Goal:
Make creative work feel controlled,
not random or overwhelming

🧠 Final Insight
This product is not about generating ads

It’s about building them step by step

