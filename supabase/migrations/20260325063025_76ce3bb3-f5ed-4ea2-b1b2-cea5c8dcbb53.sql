
-- Add missing columns to recruiter_jobs
ALTER TABLE public.recruiter_jobs
  ADD COLUMN IF NOT EXISTS preferred_skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS minimum_experience_years numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT NULL;

-- Add missing columns to recruiter_candidates  
ALTER TABLE public.recruiter_candidates
  ADD COLUMN IF NOT EXISTS extracted_skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_experience_years numeric DEFAULT NULL;

-- Create the matches table
CREATE TABLE IF NOT EXISTS public.recruiter_candidate_job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.recruiter_jobs(id) ON DELETE CASCADE,
  match_score numeric NOT NULL DEFAULT 0,
  title_score numeric NOT NULL DEFAULT 0,
  skills_score numeric NOT NULL DEFAULT 0,
  experience_score numeric NOT NULL DEFAULT 0,
  keyword_score numeric NOT NULL DEFAULT 0,
  match_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matches_recruiter ON public.recruiter_candidate_job_matches(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_matches_job ON public.recruiter_candidate_job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_matches_candidate ON public.recruiter_candidate_job_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON public.recruiter_candidate_job_matches(match_score DESC);

-- RLS
ALTER TABLE public.recruiter_candidate_job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters manage own matches"
  ON public.recruiter_candidate_job_matches
  FOR ALL
  TO public
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

-- updated_at trigger
CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.recruiter_candidate_job_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
