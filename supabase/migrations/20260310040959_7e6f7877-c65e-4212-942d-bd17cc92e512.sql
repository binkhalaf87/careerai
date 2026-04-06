
ALTER TABLE public.marketing_emails
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recruiter_name text,
  ADD COLUMN IF NOT EXISTS selected_resume_id uuid,
  ADD COLUMN IF NOT EXISTS selected_analysis_id uuid,
  ADD COLUMN IF NOT EXISTS cover_letter text,
  ADD COLUMN IF NOT EXISTS signature_block text,
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS gmail_status text;
