🧠 Interaction System
Interactions define how the product responds to the user.
They should feel:
Fast
Subtle
Intentional
Calm

Core principle
Interactions should guide, not distract

🎯 1. Interaction Philosophy

Principles
Speed > animation
Clarity > decoration
Feedback > surprise
Consistency > creativity

What we aim for
The UI feels responsive, not animated

What we avoid
Flashy effects
Bouncy animations
Delays
Over-feedback

⚡ 2. Motion System

Duration
Fast → 120ms
Default → 150ms
Slow → 200ms

Easing
ease-in-out

Rule
Never exceed 200ms

🖱️ 3. Hover States

Buttons
hover:
- slight color change
- subtle brightness shift
Example:
<button className="bg-primary hover:bg-primary-hover transition">

Cards
hover:
- very subtle background change
- optional shadow increase
<div className="hover:bg-muted transition">

List items
hover:
- highlight background (sage soft)

Rule
Hover should feel soft, not clickable like a game UI

👆 4. Active / Press States

Buttons
active:
- slight scale down (0.98)
- darker shade
<button className="active:scale-[0.98]">

Rule
Feedback must be instant

⌨️ 5. Focus States

Inputs / Textareas
focus:
- orange ring
- no default outline
<input className="focus:ring-2 focus:ring-primary outline-none" />

Accessibility
Always visible focus
Never remove focus without replacement

💬 6. Chat Interactions (CORE)

Message appearance
Fade in (optional)
No sliding animations

Streaming
Text appears progressively
Smooth, not jumpy

Actions (Improve, Use, etc.)
Instant response
No delay

Rule
Chat should feel fast and fluid

🔁 7. Transitions Between States

Page transitions
None or very subtle

Section updates
Fade or instant replace

Example
<div className="transition-opacity duration-150">

Rule
Do not animate layout heavily

🧾 8. Loading States

Types
Skeleton
Spinner (minimal)
Streaming content

Skeleton example
<div className="animate-pulse bg-muted rounded-xl h-20" />

Spinner
Only for short waits
Keep minimal

Rule
Prefer skeleton over spinner

🧠 9. Feedback States

Success
Subtle confirmation
Optional green highlight

Error
Clear message
No dramatic animations

Example
<div className="text-sm text-destructive">
 Something went wrong
</div>

Rule
Feedback should be calm and clear

🧩 10. Micro-interactions

Buttons
Hover → color shift
Click → scale down

Tags
Hover → slight background change

Inputs
Focus → highlight
Typing → no animation

Rule
Micro-interactions should be barely noticeable

🧭 11. Navigation Interactions

Sidebar
Active item → highlighted (orange or filled)
Hover → subtle background

Dropdowns
Instant open
No delay
Minimal animation

Rule
Navigation must feel immediate

🧠 12. Context Panel Interactions

Expand / collapse
Instant or subtle fade
No sliding panels

Selection
Clear highlight

Rule
Keep it fast and predictable

⚠️ 13. What to Avoid

❌ Heavy animations
Sliding panels
Parallax
Bounce effects

❌ Delays
Wait before showing content
Slow transitions

❌ Over-feedback
Too many states
Too many highlights

✨ 14. Interaction Patterns Summary

Hover:
Subtle color change

Click:
Immediate + slight scale

Focus:
Orange ring

Loading:
Skeleton preferred

Transitions:
Fast + minimal

Chat:
Fluid, no heavy animation

🧾 15. Final Summary

Interaction System

Speed:
120–200ms

Style:
Subtle
Minimal
Intentional

Goal:
Make the UI feel responsive,
not animated

Philosophy:
Guide the user,
never distract them

🚀 Final Insight
The best interaction system is the one the user:
does not notice,
but always feels

