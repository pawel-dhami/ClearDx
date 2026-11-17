-- Allow analyses produced by the trained model (PREDICTOR=ml) to be saved.
alter table public.analyses drop constraint if exists analyses_source_check;
alter table public.analyses add constraint analyses_source_check check (source in ('mock', 'groq', 'ml'));
