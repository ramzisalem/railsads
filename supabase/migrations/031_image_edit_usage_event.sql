-- Separate usage + AI run type for image edits/iterations (25 credits, same as image_generation in app logic).

alter type public.usage_event_type add value if not exists 'image_edit';
alter type public.ai_service_type add value if not exists 'image_edit';
