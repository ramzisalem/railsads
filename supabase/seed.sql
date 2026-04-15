-- Seed: system templates + plans

-- System templates (brand_id = null for global)
insert into public.templates (brand_id, key, name, description, category, structure, is_system, is_active) values
  (null, 'problem_solution', 'Problem → Solution', 'Start with a pain point, then present the product as the solution', 'direct_response', '{
    "sections": ["hook", "problem", "agitation", "solution", "benefits", "cta"],
    "guidelines": "Lead with the strongest pain point. Make the reader feel understood before presenting the solution."
  }'::jsonb, true, true),

  (null, 'before_after', 'Before / After', 'Show transformation from the current state to the desired state', 'direct_response', '{
    "sections": ["hook", "before_state", "transition", "after_state", "proof", "cta"],
    "guidelines": "Paint a vivid picture of both states. The contrast should be emotionally compelling."
  }'::jsonb, true, true),

  (null, 'ugc_testimonial', 'UGC Testimonial', 'First-person testimonial style that feels authentic and relatable', 'social_proof', '{
    "sections": ["opening_hook", "personal_story", "discovery", "result", "recommendation"],
    "guidelines": "Write in casual, conversational tone. Use real language patterns. Avoid marketing speak."
  }'::jsonb, true, true),

  (null, 'benefit_first', 'Benefit-first', 'Lead with the strongest benefit and build desire', 'benefit_driven', '{
    "sections": ["benefit_hook", "supporting_benefits", "how_it_works", "social_proof", "cta"],
    "guidelines": "Focus on outcomes, not features. Every sentence should answer: what is in it for the reader?"
  }'::jsonb, true, true),

  (null, 'list_reasons', 'List / Reasons', 'Numbered list of reasons, benefits, or use cases', 'listicle', '{
    "sections": ["hook", "list_items", "summary", "cta"],
    "guidelines": "Each item should stand alone. Lead with the strongest reason. Keep items scannable."
  }'::jsonb, true, true);

-- Plans
insert into public.plans (code, name, monthly_price_cents, monthly_credit_limit, max_brands, features, is_public, is_active) values
  ('starter', 'Starter', 7900, 2500, 1, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": false,
    "priority_generation": false,
    "image_generation": true
  }'::jsonb, true, true),

  ('pro', 'Pro', 11900, 5000, 3, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": true,
    "priority_generation": true,
    "image_generation": true
  }'::jsonb, true, true),

  ('enterprise', 'Enterprise', 0, 10000, null, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": true,
    "priority_generation": true,
    "image_generation": true,
    "dedicated_support": true,
    "custom_templates": true
  }'::jsonb, false, true);
