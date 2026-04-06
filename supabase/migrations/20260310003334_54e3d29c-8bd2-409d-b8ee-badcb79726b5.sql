
-- Marketing emails table
CREATE TABLE public.marketing_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  industry text NOT NULL,
  company_name text,
  language text NOT NULL DEFAULT 'en',
  tone text NOT NULL DEFAULT 'formal',
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketing emails" ON public.marketing_emails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own marketing emails" ON public.marketing_emails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own marketing emails" ON public.marketing_emails FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admin policies: allow admins to read all data
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all resumes" ON public.resumes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all analyses" ON public.analyses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all generated resumes" ON public.generated_resumes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all marketing emails" ON public.marketing_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
