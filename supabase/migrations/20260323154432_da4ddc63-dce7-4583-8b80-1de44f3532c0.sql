
-- Drop existing restrictive storage policies on the resumes bucket
DROP POLICY IF EXISTS "Users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from resumes" ON storage.objects;

-- Create simple policies: any authenticated user can upload/read/delete in the resumes bucket
CREATE POLICY "Authenticated users can upload to resumes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can read from resumes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can update in resumes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can delete from resumes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes');
