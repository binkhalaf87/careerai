alter table public.recruiter_candidates
  add column if not exists latest_analysis_html text,
  add column if not exists latest_analysis_json jsonb,
  add column if not exists latest_analysis_score integer,
  add column if not exists latest_analysis_at timestamptz,
  add column if not exists latest_analysis_version text;

create table if not exists public.candidate_analyses (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiter_candidates(id) on delete cascade,
  resume_id text,
  analysis_html text,
  analysis_json jsonb,
  score integer,
  analysis_type text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_candidate_analyses_candidate_id_created_at
  on public.candidate_analyses(candidate_id, created_at desc);

alter table public.candidate_analyses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_analyses'
      and policyname = 'Recruiters manage own candidate analyses'
  ) then
    create policy "Recruiters manage own candidate analyses"
      on public.candidate_analyses
      for all
      using (
        exists (
          select 1
          from public.recruiter_candidates rc
          where rc.id = candidate_analyses.candidate_id
            and rc.recruiter_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.recruiter_candidates rc
          where rc.id = candidate_analyses.candidate_id
            and rc.recruiter_id = auth.uid()
        )
      );
  end if;
end $$;
