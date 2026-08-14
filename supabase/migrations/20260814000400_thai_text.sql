-- Thai text support.
--
-- Storage was never the problem: the database is UTF-8, so Thai round-trips fine
-- and always has. Two things genuinely do not work out of the box:
--
--   1. Sorting. The database collation is decided when the Supabase project is
--      created and cannot be changed afterwards, so `order by name` uses whatever
--      that was (en_US.UTF-8 locally) and puts Thai in codepoint order rather than
--      Thai dictionary order. Fixed per column, which is portable to any project.
--
--   2. Substring search. Thai is written without spaces between words, so a
--      full-text tokeniser treats a whole phrase as one token and mid-phrase
--      searches miss. Trigram matching sidesteps tokenisation entirely.

-- ─────────────── Trigram search ───────────────
-- Supabase keeps extensions in their own schema rather than public.
create extension if not exists pg_trgm with schema extensions;

-- ─────────────── Thai collation ───────────────
-- Applied only to columns that are actually ordered for display. Notes and other
-- free text are never sorted, so leaving them on the default costs nothing and
-- avoids rebuilding indexes for no reason.
--
-- Guarded: if the ICU collation is missing the migration logs and moves on rather
-- than failing the whole deploy. Sorting then falls back to the database default,
-- which is wrong for Thai but not broken.
do $$
declare
  v_collation text := 'th-TH-x-icu';
begin
  if not exists (select 1 from pg_collation where collname = v_collation) then
    raise warning 'Collation % not available — Thai sorting will use the database default', v_collation;
    return;
  end if;

  execute format(
    'alter table exercises alter column name type text collate %I', v_collation);
  execute format(
    'alter table plans alter column name type text collate %I', v_collation);
  execute format(
    'alter table plan_days alter column label type text collate %I', v_collation);
  execute format(
    'alter table user_equipment alter column label type text collate %I', v_collation);
end $$;

-- ─────────────── Indexes ───────────────
-- Trigram GIN, so `name ilike '%คำ%'` is indexed rather than a sequential scan.
-- Trigram operators ignore collation, so this is unaffected by the block above.
create index exercises_name_trgm_idx
  on exercises using gin (name extensions.gin_trgm_ops);

-- ─────────────── Search helper ───────────────
-- One definition of "search the library", so the app cannot drift from it.
-- Ordering: exact prefix first, then trigram similarity, then Thai alphabetical.
create or replace function search_exercises(q text)
returns setof exercises
language sql
stable
set search_path = public, extensions
as $$
  select *
  from exercises e
  where q is null or q = ''
     or e.name ilike '%' || q || '%'
     or e.id   ilike '%' || q || '%'
  order by
    (e.name ilike q || '%') desc,
    extensions.similarity(e.name, q) desc,
    e.name
$$;

comment on function search_exercises(text) is
  'Library search. Trigram-based so it works on Thai, which has no word boundaries.';
