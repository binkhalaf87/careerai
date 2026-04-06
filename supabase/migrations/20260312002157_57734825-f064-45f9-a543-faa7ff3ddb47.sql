
-- Interview sessions table
CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  session_title text NOT NULL DEFAULT 'Mock Interview',
  job_title text,
  overall_score numeric,
  summary_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview sessions" ON public.interview_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interview sessions" ON public.interview_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interview sessions" ON public.interview_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interview sessions" ON public.interview_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Interview session answers table
CREATE TABLE public.interview_session_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  question_order integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  transcript_text text,
  score numeric,
  strengths_json jsonb DEFAULT '[]'::jsonb,
  improvements_json jsonb DEFAULT '[]'::jsonb,
  ideal_answer text,
  confidence_assessment text,
  relevance_assessment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_session_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview answers" ON public.interview_session_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.interview_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can insert own interview answers" ON public.interview_session_answers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.interview_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can update own interview answers" ON public.interview_session_answers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.interview_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
