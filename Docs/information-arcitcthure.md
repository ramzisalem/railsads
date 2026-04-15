🧠 Information Architecture (IA)
Defines how the product is structured and organized.

Core principle
Everything revolves around the product

🧱 1. Top-Level Structure

Workspace (Brand)

├── Creative Studio
├── Products
├── Competitors
├── Brand

🧩 2. Core Entities

Brand (Workspace)
Global context:
- Identity
- Tone
- Colors
- Assets

Products
Each product contains:
- Description
- ICPs
- Creatives

ICPs
Belong to a product
Define audience targeting

Creatives
Generated per:
Product + ICP

Threads
Each creative session = thread
Contains:
- Messages
- Versions
- Iterations

🧠 3. Navigation Structure

Sidebar
[Brand Selector]

Creative Studio
Products
Competitors
Brand

Behavior
Persistent
Global
Context-aware

🧩 4. Page-Level Structure

Creative Studio
Main → Chat + output
Side → Context panel (Product, ICP, Template)

Products
List of products
→ Product detail:
  - ICPs
  - Creatives

Competitors
List of competitors
→ Ads
→ Extracted patterns

Brand
Brand identity
Visual system
Messaging

🧠 5. Relationships

Hierarchy
Brand
├── Products
│    ├── ICPs
│    ├── Creatives
│         ├── Threads

Key rule
Everything is tied to a product

🧩 6. Context System

Context is always visible
Product
ICP
Template

Behavior
Changes affect generation

Rule
Context is not hidden in prompts

🧠 7. Scalability Strategy

Future features fit into:
Products
Creatives
Competitors

Avoid
Adding disconnected features

🧾 8. Naming Principles

Use clear naming
Products → not "Items"
Creatives → not "Outputs"
ICP → keep (or rename to Audience later)

Rule
Names should match user mental model

⚠️ Common Mistakes

❌ Flat structure
Everything at same level

❌ Hidden relationships
Users don’t know where things belong

❌ Over-complex hierarchy
Too many nested levels

🧾 Summary

Information Architecture

Top level:
- Creative Studio
- Products
- Competitors
- Brand

Core model:
Brand → Product → ICP → Creative → Thread

Principles:
- Product-centric
- Context visible
- Simple hierarchy

🧠 Final Insight
If IA is clear,

the product feels simple
even if it is powerful

