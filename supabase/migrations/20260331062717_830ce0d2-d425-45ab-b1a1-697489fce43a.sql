
-- Add latest analysis columns to recruiter_candidates
ALTER TABLE public.recruiter_candidates
  ADD COLUMN IF NOT EXISTS ats_score integer,
  ADD COLUMN IF NOT EXISTS latest_analysis_html text,
  ADD COLUMN IF NOT EXISTS latest_analysis_json jsonb,
  ADD COLUMN IF NOT EXISTS latest_analysis_score numeric,
  ADD COLUMN IF NOT EXISTS latest_analysis_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_analysis_version text,
  ADD COLUMN IF NOT EXISTS interview_score numeric,
  ADD COLUMN IF NOT EXISTS interview_recommendation text,
  ADD COLUMN IF NOT EXISTS interview_results jsonb;

-- Create candidate_analyses history table
CREATE TABLE IF NOT EXISTS public.candidate_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  resume_id text,
  analysis_html text,
  analysis_json jsonb,
  score numeric,
  analysis_type text DEFAULT 'manual_refresh',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_analyses ENABLE ROW LEVEL SECURITY;

-- RLS: recruiters can manage analyses for their own candidates
CREATE POLICY "Recruiters manage own candidate analyses"
  ON public.candidate_analyses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_candidates rc
      WHERE rc.id = candidate_analyses.candidate_id
        AND rc.recruiter_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruiter_candidates rc
      WHERE rc.id = candidate_analyses.candidate_id
        AND rc.recruiter_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_candidate_analyses_candidate_id ON public.candidate_analyses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_analyses_created_at ON public.candidate_analyses(created_at DESC);
