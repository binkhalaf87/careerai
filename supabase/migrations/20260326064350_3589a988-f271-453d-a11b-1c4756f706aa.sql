-- Add status column to saved_jobs for application tracking
ALTER TABLE public.saved_jobs 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'saved';

-- Add updated_at column
ALTER TABLE public.saved_jobs 
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Allow users to update their own saved jobs (needed for status changes)
CREATE POLICY "Users can update own saved jobs"
ON public.saved_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);