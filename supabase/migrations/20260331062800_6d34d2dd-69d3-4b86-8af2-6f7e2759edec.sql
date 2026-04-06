
-- Create recruiter_interview_sessions table referenced by code
CREATE TABLE IF NOT EXISTS public.recruiter_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.recruiter_jobs(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'internal',
  status text NOT NULL DEFAULT 'pending',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_score numeric,
  recommendation text,
  evaluation_summary text,
  summary jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters manage own interview sessions"
  ON public.recruiter_interview_sessions FOR ALL
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

CREATE INDEX IF NOT EXISTS idx_ris_recruiter ON public.recruiter_interview_sessions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_ris_candidate ON public.recruiter_interview_sessions(candidate_id);
