ALTER TABLE public.generated_resumes 
ADD COLUMN source_resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
ADD COLUMN ats_score integer DEFAULT NULL;