-- Ensure profile columns exist (safe to run multiple times)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_analysis_used boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_upload_count integer NOT NULL DEFAULT 0;
