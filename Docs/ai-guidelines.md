🧠 AI System Overview
The AI system powers:
Brand understanding
ICP generation
Competitor analysis
Creative generation
Creative iteration
Image generation

Core principle
AI should feel consistent, structured, and predictable — not random

🎯 1. AI Philosophy

Principles
Context > prompts
Iteration > one-shot
Structure > raw output
Guidance > freedom

What we avoid
Random outputs
Unstructured text
Context repetition
Overly long prompts

What we aim for
Consistent outputs
Clear structure
Predictable behavior
High signal, low noise

🧠 2. Model Strategy

Model roles
Task
Model
Brand extraction
gpt-4.1-mini
ICP generation
gpt-4.1-mini
Competitor analysis
gpt-4.1-mini
Creative generation
gpt-4.1
Creative iteration
gpt-4.1-mini / gpt-4.1
Image generation
gpt-image-1
Thread naming
gpt-4.1-mini
Embeddings (later)
text-embedding-3-small


Routing logic
High-value output → gpt-4.1
Frequent / structured → gpt-4.1-mini
Images → gpt-image-1

Rule
Use the cheapest model that delivers acceptable quality

🧩 3. AI Architecture

Layers

1. Prompt Layer (YOUR IP)
Prompt templates
Schemas
Instructions

2. Service Layer
brandImportService
icpService
competitorService
creativeService
creativeRevisionService
imageService

3. Provider Layer
OpenAI Responses API

Rule
Never mix business logic inside prompts

🧠 4. Context System (CRITICAL)

Context types
Brand
Product
ICP
Template
Competitor patterns
Thread history

Context strategy
Store once → reuse everywhere

❌ Bad
Send full brand + ICP + product every time

✅ Good
Send compressed context

Example
Brand: BlendX
Tone: modern, energetic
Positioning: fast healthy meals
Product: portable blender
ICP: busy professionals

Rule
Context must be compact, structured, and reusable

🧾 5. Structured Outputs

Always use schemas

Example (creative output)
{
 "hooks": [],
 "headlines": [],
 "primary_texts": [],
 "creative_direction": "",
 "recommendation": ""
}

Rule
Never return raw text blobs

Why
Better UI rendering
Predictable outputs
Less parsing logic

💬 6. Creative Generation

Input
Product + ICP + Brand + Template

Output
Hooks
Headlines
Primary texts
Creative direction

Model
gpt-4.1

Rule
This is the highest quality moment — do not optimize for cost here

🔁 7. Creative Iteration

Behavior
Modify existing creative
Do NOT regenerate from scratch

Types of edits
Tone change
Length change
Audience shift
Format change
Angle change

Model routing
Small edit → gpt-4.1-mini
Big rewrite → gpt-4.1

Rule
Iteration should feel like editing, not restarting

🧠 8. Prompt Design

Structure
1. Role
2. Context
3. Task
4. Constraints
5. Output schema

Example
You are an expert ad copywriter.

Context:
- Brand: ...
- Product: ...
- ICP: ...

Task:
Generate 3 hooks...

Constraints:
- Short
- Emotional
- No jargon

Output:
Return JSON with fields...

Rule
Prompts must be deterministic and structured

💾 9. Memory & Threads

Threads store
Messages
Outputs
Selections
Versions

Behavior
User can return and continue

Rule
Threads are the source of truth for creative work

🧠 10. Cost Optimization

Strategy
Use mini model for frequent tasks
Use full model for premium output

Techniques
Context compression
Short prompts
Reuse outputs
Limit tokens

Rule
Optimize cost without degrading core value

🧩 11. Image Generation

Model
gpt-image-1

Inputs
Creative direction
Brand style
Colors
Visual tags

Rule
Images must follow brand identity

🧠 12. Consistency System

Ensure consistency via
Shared prompts
Shared schemas
Reusable context

Rule
Same input → similar output quality

⚠️ 13. Failure Handling

Cases
Bad output
Empty output
API failure

Behavior
Retry
Fallback model
Show error message

Rule
Never leave user stuck

🧪 14. Testing

Test cases
Different products
Different ICPs
Edge cases

What to check
Output quality
Consistency
Structure

Rule
AI must be tested like a feature, not a black box

🧾 15. AI Patterns Summary

Core Flow:
Context → Generate → Iterate → Select

Key Systems:
- Structured outputs
- Context compression
- Model routing
- Persistent threads

Goals:
- Consistency
- Quality
- Cost control

🧠 Final Insight
Your product is not UI-driven

It is AI-behavior driven

🔥 The real differentiator
Not better models

Better orchestration

