-- 035: Add `studio_chat` to the ai_service_type enum.
--
-- The Studio has starter intents ("Brainstorm angles", "Visual concept")
-- that produce a plain-text chat reply instead of a structured creative.
-- The new /api/studio/chat route records its ai_runs with the dedicated
-- `studio_chat` service type so we can tell brainstorm turns apart from
-- creative / revision turns in cost + quality analytics.

alter type public.ai_service_type add value if not exists 'studio_chat';
