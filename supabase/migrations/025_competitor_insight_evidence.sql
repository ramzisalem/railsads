-- 025: Cited evidence per pattern in competitor insights.
--
-- The analysis output now grounds every pattern in concrete ads. We persist
-- the citations as JSONB instead of a normalized table because they are
-- always rendered together with the insight that produced them and never
-- queried independently.
--
-- Shape:
--   {
--     "summary_evidence_ad_ids": ["uuid", ...],
--     "patterns": [
--       {
--         "category": "hook" | "angle" | "emotional" | "visual" | "offer" | "cta",
--         "pattern": "Promises 'no more dry skin'",
--         "evidence_ad_ids": ["uuid", ...]
--       }
--     ]
--   }
--
-- Defaulting to '[]' keeps the column safe to read on legacy insight rows
-- generated before this migration.

alter table public.competitor_insights
  add column if not exists evidence jsonb not null default '[]'::jsonb;

comment on column public.competitor_insights.evidence is
  'Per-pattern citations: array of {category, pattern, evidence_ad_ids[]} grounding each pattern in specific competitor_ads.';
