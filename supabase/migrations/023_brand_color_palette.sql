-- Segmented brand colors (role + hex) for prompts and UI; legacy columns stay in sync from app layer.
alter table public.brand_visual_identity
  add column if not exists color_palette jsonb not null default '[]'::jsonb;

comment on column public.brand_visual_identity.color_palette is
  'Array of {segment, hex} e.g. [{"segment":"primary","hex":"#1a2b3c"}]; primary/secondary/accent mirror first matching segments.';
