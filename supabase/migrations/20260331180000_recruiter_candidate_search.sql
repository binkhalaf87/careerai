-- Recruiter candidate search function + index
create index if not exists idx_recruiter_candidates_search_text
on public.recruiter_candidates
using gin (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(current_title, '') || ' ' ||
    coalesce(array_to_string(extracted_skills, ' '), '') || ' ' ||
    coalesce(extracted_text, '') || ' ' ||
    coalesce(structured_data::text, '')
  )
);

create or replace function public.search_recruiter_candidates(
  search_text text,
  recruiter_uuid uuid,
  limit_count integer default 100,
  offset_count integer default 0,
  sort_by text default 'match_score'
)
returns table (
  id uuid,
  name text,
  email text,
  current_title text,
  ats_score integer,
  fit_score numeric,
  created_at timestamptz,
  extracted_skills text[],
  extracted_text text,
  snippet text
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      c.id,
      c.name,
      c.email,
      c.current_title,
      c.ats_score,
      c.fit_score,
      c.created_at,
      c.extracted_skills,
      c.extracted_text,
      left(coalesce(c.extracted_text, c.structured_data::text, ''), 320) as snippet,
      ts_rank(
        to_tsvector(
          'simple',
          coalesce(c.name, '') || ' ' ||
          coalesce(c.current_title, '') || ' ' ||
          coalesce(array_to_string(c.extracted_skills, ' '), '') || ' ' ||
          coalesce(c.extracted_text, '') || ' ' ||
          coalesce(c.structured_data::text, '')
        ),
        websearch_to_tsquery('simple', nullif(trim(search_text), ''))
      ) as rank_score
    from public.recruiter_candidates c
    where c.recruiter_id = recruiter_uuid
      and (
        coalesce(trim(search_text), '') = ''
        or to_tsvector(
          'simple',
          coalesce(c.name, '') || ' ' ||
          coalesce(c.current_title, '') || ' ' ||
          coalesce(array_to_string(c.extracted_skills, ' '), '') || ' ' ||
          coalesce(c.extracted_text, '') || ' ' ||
          coalesce(c.structured_data::text, '')
        ) @@ websearch_to_tsquery('simple', trim(search_text))
        or c.name ilike '%' || trim(search_text) || '%'
        or coalesce(c.current_title, '') ilike '%' || trim(search_text) || '%'
        or coalesce(c.extracted_text, '') ilike '%' || trim(search_text) || '%'
        or coalesce(c.structured_data::text, '') ilike '%' || trim(search_text) || '%'
      )
  )
  select
    b.id,
    b.name,
    b.email,
    b.current_title,
    b.ats_score,
    b.fit_score,
    b.created_at,
    b.extracted_skills,
    b.extracted_text,
    b.snippet
  from base b
  order by
    case when sort_by = 'ats_score' then coalesce(b.ats_score, 0)::numeric end desc,
    case when sort_by = 'date' then extract(epoch from b.created_at) end desc,
    case when sort_by = 'match_score' then coalesce(b.fit_score, b.rank_score * 100, 0) end desc,
    b.created_at desc
  limit greatest(limit_count, 1)
  offset greatest(offset_count, 0);
$$;

grant execute on function public.search_recruiter_candidates(text, uuid, integer, integer, text) to authenticated;
