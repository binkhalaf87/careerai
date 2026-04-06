
CREATE TABLE public.user_resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_file_url TEXT NOT NULL,
  raw_resume_text TEXT,
  structured_resume_json JSONB DEFAULT '{}'::jsonb,
  detected_job_title TEXT,
  detected_skills TEXT,
  detected_experience_level TEXT,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_resumes"
  ON public.user_resumes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_resumes"
  ON public.user_resumes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_resumes"
  ON public.user_resumes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_resumes"
  ON public.user_resumes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user_resumes"
  ON public.user_resumes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
