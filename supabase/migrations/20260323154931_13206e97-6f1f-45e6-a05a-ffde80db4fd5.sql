
-- Remove old permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload to resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read from resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update in resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;

-- Job Seekers: upload to resumes/{uid}/*
CREATE POLICY "Job seekers upload own resumes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[1] != 'recruiter'
);

-- Job Seekers: read own files
CREATE POLICY "Job seekers read own resumes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Job Seekers: delete own files
CREATE POLICY "Job seekers delete own resumes"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Recruiters: upload to recruiter/{uid}/candidates/*
CREATE POLICY "Recruiters upload candidate files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = 'recruiter'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Recruiters: read own candidate files
CREATE POLICY "Recruiters read own candidate files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = 'recruiter'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Recruiters: delete own candidate files
CREATE POLICY "Recruiters delete own candidate files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = 'recruiter'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
