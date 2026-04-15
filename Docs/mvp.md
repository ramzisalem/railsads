MVP Brief - AI Ad Workspace for Ecommerce Brands
1. Product vision
We are building an AI workspace for ecommerce brands that helps them go from brand data to usable ad creatives fast.
This is not just an AI generator. It is a system that:
understands the brand
organizes products and audiences
captures competitor signals
generates ad creatives
lets users iterate on the same creative over time
The goal is to make ad creation feel like a modern SaaS workflow, not like prompting a blank chatbot.

2. Core promise
Paste your website, get your brand system, and create product-specific ads in minutes.
The product should reduce the time it takes to go from:
website → product → ICP → ad concept → draft creative → refined version

3. Who this is for
Primary users:
ecommerce founders
solo operators
growth marketers
performance marketers
small ecommerce teams
agencies managing multiple brands

4. Product principles
These are the principles we should protect while building:
1. Brand = workspace
Each brand is its own workspace, with its own:
products
ICPs
competitors
patterns
creatives
2. Product-centric structure
Users think in products, not in abstract entities.
So products are the main operational hub.
3. Chat-first creation
Creative generation and iteration should happen in a simple chat-based workspace.
4. Context-driven AI
The system should not generate generic outputs.
Every generation must be grounded in:
brand context
product context
ICP context
optional competitor patterns
5. Iteration-first
Users should not generate once and lose the result.
They should be able to continue working on the same creative later.
6. Keep the UX simple
One chat box, one context panel, clear pages, no bloated interface.

5. Information architecture
Workspace switcher
At the top of the side nav, the user can switch between brands/workspaces.
Side nav
Dashboard
Creative Studio
Products
Competitors
Brand
Settings
Notes:
ICP is not top-level. It lives under Products.
Patterns are mostly surfaced under Products and Competitors.
Creative Studio is the main action area, but not the whole product.

6. Core MVP pages
A. Dashboard
Purpose
A lightweight entry point for returning users.
What it should include
continue last creative
recent creatives
quick action to create a new ad
quick links to products
optional “today’s suggestions”
Today’s suggestions examples
test a problem-focused hook for Portable Blender
try UGC template for Protein Powder
continue yesterday’s skincare creative
This should be light and useful, not an analytics dashboard.

B. Brand page
Purpose
Store the global brand DNA for the workspace.
What it contains
Overview
brand name
website
short description
Positioning & messaging
positioning statement
value proposition
tone of voice
messaging notes
Visual identity
primary color
secondary color
accent color
style tags such as minimal, premium, playful, bold
Personality
modern
efficient
premium
trustworthy
energetic
Source / sync
imported from website
last imported date
re-import website
UX
inline editing
visual color chips
minimal and clean
not form-heavy

C. Products page
Purpose
Products are the main operational hub.
Products list
Each product card/list item shows:
image
name
price
short description
Product detail page
Each product page contains:
1. Overview
product name
description
price
product images
key benefits
2. ICPs
Each product can have one or more ICPs.
Each ICP includes:
title
summary
pains
desires
objections
triggers
User actions:
edit ICP
regenerate ICP
add ICP
duplicate ICP
delete ICP
3. Competitor signals for this product
A filtered view of relevant competitor insights for this product, such as:
recurring hook styles
common angles
visual patterns
emotional triggers
4. CTA
Create ad for this product
That CTA opens Creative Studio with the product preselected.

D. Competitors page
Purpose
This is the market intelligence hub.
It is where users manage competitor brands and extract patterns from competitor ads.
Sections
Competitor list
Each competitor shows:
name
website
number of ads saved
last analyzed
Actions:
open
edit
delete
add ads
Competitor detail
Overview
competitor name
website
notes
linked products in our workspace
Ads library
Each ad entry can contain:
image or screenshot
link
ad text
notes
mapped product
Extracted insights
The system summarizes:
hook patterns
angle patterns
emotional triggers
visual patterns
offer styles
CTA tendencies
Examples:
“Stop doing X” hooks appear often
pain-first messaging dominates
before/after visuals are common
convenience is the strongest emotional driver
Product mapping
Competitor insights should be attachable to a specific product in our workspace.
This is important so competitor data is actionable, not just informational.
User actions
add competitor manually
paste competitor website
upload competitor ad screenshots
paste competitor ad links
analyze ads
re-run analysis
map competitor insights to product

E. Creative Studio
Purpose
The main place where users generate, refine, and continue working on creatives.
Core UX model
chat-first
right-side context panel
structured output blocks in chat
persistent creative threads behind the scenes
Layout
Top bar
Creative Studio
Threads dropdown
New creative button
Main conversation area
This is where:
the system generates initial creatives
the user gives instructions
the system updates the creative
the conversation persists
Right context panel
Always visible, contains:
Product
ICP
Template
Angle
Awareness level
Optional:
short ICP summary
product thumbnail
small recommendation
Bottom input box
One chat field for all actions.
Examples:
generate a new ad
make this more emotional
try UGC style
shorten the headline
make it more premium
give me 3 more hooks
First state
No blank screen.
The user should enter with enough context already selected that the system can generate something meaningful immediately.
Output format inside chat
Outputs should render as structured blocks, not plain text dumps.
Blocks:
Hooks
Primary text
Headlines
Creative direction
Image / prompt / preview
Each block should support:
Use this
Improve
Copy
Active creative
When the user clicks “Use this,” that becomes the current working direction.
Later edits should operate on that chosen direction.
Editing behavior
Examples:
make the hook more emotional
shorten the copy
switch to before/after template
change the visual style
make it more premium
adapt it for a different ICP
Threads
Threads live inside Creative Studio, not as a separate nav item.
A thread is a saved creative workspace for a specific:
product
ICP
direction
Thread examples:
Portable Blender — Busy Professionals
Protein Powder — Athletes
Skincare Serum — Women 25–35
Opening a thread restores:
product
ICP
template
angle
awareness
message history
current creative state
Templates
Examples:
Problem → Solution
Before / After
UGC Testimonial
Benefit-first
List / Reasons
Templates can be selected via:
dropdown in context panel
chat instruction
Awareness levels
unaware
problem-aware
solution-aware
product-aware
most-aware
Export
Always easy to access:
copy ad text
copy selected section
download image

F. Settings
Minimal for MVP:
profile
basic workspace settings if needed
logout

7. Onboarding flow
This is the first-run experience and must feel impressive.
Step 1 — Create workspace
User chooses to create a new brand/workspace.
Step 2 — Paste website
User pastes the brand website.
Step 3 — Website analysis
System shows a progressive loading experience:
extracting brand identity
detecting colors
finding products
understanding positioning
Step 4 — Review Brand
User reviews and edits:
brand name
tone
positioning
colors
Step 5 — Review Products
All extracted products are selected by default.
User can:
deselect products
edit product info
add missing product manually
Step 6 — Generate ICPs
The system generates ICPs only for selected products.
Step 7 — Optional competitor setup
User can:
skip
add competitors now
upload a few competitor ad references
Step 8 — Land in Creative Studio
User lands with:
a product already selected
an ICP already selected
first creatives already generated
This is the wow moment.

8. Ongoing user flows
Flow 1 — Daily use
Open workspace
→ Dashboard
→ Continue recent creative or create a new one
→ Work in Creative Studio
→ Export
→ Leave
→ Return later and continue

Flow 2 — Product-first creation
Open Products
→ Select product
→ Review ICPs
→ Click “Create ad for this product”
→ Creative Studio opens with product prefilled
→ Select ICP
→ Generate
→ Iterate
→ Export

Flow 3 — Competitor-first research
Open Competitors
→ Add competitor
→ Upload ad references
→ Analyze
→ View extracted patterns
→ Map insights to a product
→ Open Creative Studio with that product
→ Generate ad influenced by pattern

Flow 4 — Continue a previous creative
Open Creative Studio
→ Open Threads dropdown
→ Select previous thread
→ Restore state
→ Continue editing in chat
→ Export updated creative


9. Product diagrams
A. Product structure
Workspace (Brand)
├── Brand
├── Products
│   ├── Product A
│   │   ├── ICPs
│   │   └── Competitor signals
│   └── Product B
│       ├── ICPs
│       └── Competitor signals
├── Competitors
│   ├── Competitor A
│   │   ├── Ads
│   │   └── Patterns
│   └── Competitor B
└── Creative Studio
    ├── Threads
    ├── Messages
    └── Creative versions

B. Context assembly for creative generation
Brand context
+ Product context
+ Selected ICP
+ Selected template
+ Selected angle
+ Selected awareness
+ Optional competitor patterns
+ Existing thread state
= Compact generation context

C. Main user journey
Website
→ Brand
→ Products
→ ICPs
→ Competitors (optional)
→ Creative Studio
→ Thread
→ Export

D. Competitor insight flow
Competitor added
→ Ads uploaded or linked
→ AI extracts hooks / angles / emotions / visuals
→ Insights attached to competitor
→ Insights mapped to product
→ Used in Creative Studio

E. Creative thread flow
New creative
→ Initial generation
→ User selects direction
→ User edits in chat
→ New version stored
→ User leaves
→ User reopens thread
→ Continues editing


10. Data and memory model
Workspace / brand
Stores:
brand name
website
description
tone
positioning
colors
style tags
personality tags
Products
Stores:
brand_id
name
description
price
images
benefits
ICPs
Stores:
product_id
title
summary
pains
desires
objections
triggers
Competitors
Stores:
brand_id
competitor name
website
notes
Competitor ads
Stores:
competitor_id
optional mapped product_id
image
link
text
notes
Competitor insights / patterns
Stores:
competitor_id or product_id
hook patterns
angle patterns
emotions
visual patterns
offer patterns
Threads
Stores:
brand_id
product_id
icp_id
template
angle
awareness
title
last updated
Messages
Stores:
thread_id
sender
content
assistant structured output payload if relevant
Creative versions
Stores:
thread_id
parent_version_id
selected output state
created_at

11. AI responsibilities
Website extraction
Extract:
brand identity
products
colors
tone
messaging
ICP generation
Generate:
summary
pains
desires
objections
triggers
Competitor analysis
Extract:
hook patterns
angles
emotions
visual patterns
offer structures
Creative generation
Generate structured outputs from:
workspace
product
ICP
template
angle
awareness
optional competitor patterns
Creative editing
Update the active creative based on user instructions while preserving context.

12. UX rules
These are non-negotiable.
1. No blank states
The user should always see something useful.
2. One clear next action
Every page should make the next step obvious.
3. Product-centric structure
Most work should start from Products or Creative Studio.
4. Competitors should feel actionable
This is not a reporting page. It is a decision-support page.
5. Creative Studio stays simple
One chat box, one context panel, structured outputs.
6. Context must always be visible
The user should always know:
what product
what ICP
what strategy
7. Outputs must be actionable
Every major output should be easy to use, improve, or copy.

13. Out of scope for MVP
We should not build these yet:
automated competitor scraping
live Meta Ads integrations
analytics dashboards
performance attribution
collaboration / roles / permissions
advanced workflow automation
visible complex version tree
creative scoring engine
The system should be designed so these can be added later.

14. Why this MVP is strong
This MVP solves the real workflow instead of just offering AI generation.
It gives the user:
a workspace for each brand
a product-centric structure
reusable ICPs
competitor intelligence
a simple chat-first creation flow
persistent creative memory
structured outputs that are usable immediately
This makes it much more than a generic ad generator.

15. One-paragraph summary
We are building a workspace-based AI product for ecommerce brands. A user creates a brand workspace by pasting a website, the system extracts brand identity and products, then generates ICPs for selected products. Products become the core operational hub, Competitors become the market intelligence hub, Brand defines the global workspace DNA, and Creative Studio is the main creation space where users generate and iteratively refine product-specific ads through a simple chat-first interface with visible context and persistent threads. The result is a system that helps teams create better ads faster without starting from scratch every time.


