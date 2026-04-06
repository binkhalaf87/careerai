CREATE TABLE public.enhancement_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  raw_text text,
  structured_data jsonb DEFAULT '{}'::jsonb,
  improved_data jsonb DEFAULT '{}'::jsonb,
  original_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enhancement_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.enhancement_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.enhancement_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.enhancement_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.enhancement_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all sessions" ON public.enhancement_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_enhancement_sessions_updated_at BEFORE UPDATE ON public.enhancement_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();