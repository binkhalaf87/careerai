
-- Add account_type to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'job_seeker',
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Recruiter jobs/openings
CREATE TABLE public.recruiter_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  title text NOT NULL,
  department text,
  seniority text,
  required_skills text[],
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own jobs" ON public.recruiter_jobs FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Recruiter candidates
CREATE TABLE public.recruiter_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  job_id uuid REFERENCES public.recruiter_jobs(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  current_title text,
  experience_years numeric,
  stage text NOT NULL DEFAULT 'new',
  fit_score integer,
  fit_label text,
  file_name text,
  file_path text,
  extracted_text text,
  structured_data jsonb DEFAULT '{}'::jsonb,
  ai_report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own candidates" ON public.recruiter_candidates FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Recruiter notes on candidates
CREATE TABLE public.recruiter_candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_candidate_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own notes" ON public.recruiter_candidate_notes FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Recruiter interview question sets
CREATE TABLE public.recruiter_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  candidate_id uuid REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.recruiter_jobs(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Interview Questions',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_question_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own question sets" ON public.recruiter_question_sets FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Recruiter AI interview sessions (sent to candidates)
CREATE TABLE public.recruiter_ai_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  question_set_id uuid REFERENCES public.recruiter_question_sets(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  answers jsonb DEFAULT '[]'::jsonb,
  overall_score numeric,
  summary jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_ai_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own ai interviews" ON public.recruiter_ai_interviews FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Recruiter live interview scheduling
CREATE TABLE public.recruiter_live_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.recruiter_candidates(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  meeting_link text,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_live_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own live interviews" ON public.recruiter_live_interviews FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- Triggers for updated_at
CREATE TRIGGER update_recruiter_jobs_updated_at BEFORE UPDATE ON public.recruiter_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recruiter_candidates_updated_at BEFORE UPDATE ON public.recruiter_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recruiter_question_sets_updated_at BEFORE UPDATE ON public.recruiter_question_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recruiter_live_interviews_updated_at BEFORE UPDATE ON public.recruiter_live_interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
