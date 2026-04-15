🧠 Layout System
The layout system defines how content is structured, aligned, and distributed across the application.
It ensures:
Consistency
Clarity
Scalability
Balance

Core principle
Structure first, then content

🧱 1. App Shell

Global structure
<div className="flex min-h-screen bg-background">
 <Sidebar />
 <MainContent />
</div>

Layout model
Sidebar (fixed)
+
Main content (fluid)

Sidebar
Width → 260–280px
Position → fixed
Height → full screen

Main content
Flexible width
Centered container
Scrollable

📐 2. Container System

Max width
<div className="max-w-[1600px] mx-auto px-6 py-6 md:px-8 md:py-8">

Rules
Max width → 1400–1600px
Padding → 24px (mobile) / 32px (desktop)
Always centered

Why
Prevents overly stretched UI
Maintains readability

🧩 3. Page Structure

Standard page layout
<div className="space-y-8">
 <Header />
 <Content />
</div>

Sections
Header → title + actions
Body → main content
Optional → side panel

Spacing
Between sections → 32px

🧠 4. Header Layout

Structure
<div className="flex items-center justify-between">
 <Title />
 <Actions />
</div>

Rules
Left → title + subtitle
Right → primary actions

Example
<h1 className="heading-xl">Creative Studio</h1>

🧩 5. Grid System

Default grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

Gap
Default gap → 24px

Use cases
cards
products
competitors

🧠 6. Two-Column Layout (IMPORTANT)
Used in:
Creative Studio

Structure
<div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
 <Main />
 <SidePanel />
</div>

Columns
Main → flexible
Side panel → 320–360px

Behavior
Desktop → 2 columns
Mobile → stacked

Rule
Main content always dominant

🧩 7. Three-Column Layout (optional later)

Structure
Sidebar | Main | Context

Use only if needed
Avoid complexity early

🧠 8. Sidebar Layout

Sections
Top → Brand selector
Middle → Navigation
Bottom → Threads / secondary items

Spacing
Padding → 16–20px
Gap between items → 8px

Behavior
Sticky / fixed
Scrollable if needed

🧾 9. Content Density

Rule
Prefer medium density

Balance
Too dense → overwhelming
Too loose → empty

Strategy
Use spacing instead of separators
Group elements clearly

📱 10. Responsive Behavior

Breakpoints
sm → mobile
md → tablet
lg → desktop
xl → large screens

Sidebar
Desktop → visible
Mobile → hidden / drawer

Two-column layout
Desktop → side-by-side
Mobile → stacked

Context panel
Mobile → collapsible or bottom sheet

🧠 11. Alignment Rules

Horizontal
Left-aligned by default

Vertical
Use flex alignment
items-center for UI
items-start for content

Rule
Avoid centered layouts for main content

🧩 12. Spacing in Layout

Page padding
24–32px

Section spacing
32px

Component spacing
16–24px

Rule
Follow spacing.md strictly

🧭 13. Scroll Behavior

Main content
Scrollable

Sidebar
Fixed or independently scrollable

Rule
Avoid nested scroll areas when possible

⚠️ 14. Common Mistakes

❌ Too many layouts
Stick to 2–3 layout patterns max

❌ Inconsistent widths
Breaks visual rhythm

❌ Centered everything
Feels weak and unfocused

❌ Overusing grids
Not everything needs a grid

🧾 15. Layout Patterns Summary

App Shell:
Sidebar + Main

Page:
Header + Content

Grids:
Cards and lists

Creative Studio:
2-column layout (main + context)

Responsive:
Stack on mobile

🧠 Final Insight
Good layout is invisible

It lets content and actions feel obvious

