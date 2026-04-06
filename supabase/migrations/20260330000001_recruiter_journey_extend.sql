-- ============================================================
-- TALENTRY — Recruiter Journey Extension Migration
-- Extends existing schema WITHOUT replacing any table.
-- Adds: interview_results JSONB, ats_score, extracted_skills
--       to recruiter_candidates (if not already present)
-- Adds: recruiter_interview_sessions table for AI interview flow
-- ============================================================

-- 1. Extend recruiter_candidates with journey tracking fields
ALTER TABLE recruiter_candidates
  ADD COLUMN IF NOT EXISTS ats_score integer,
  ADD COLUMN IF NOT EXISTS interview_results jsonb,
  ADD COLUMN IF NOT EXISTS interview_recommendation text,
  ADD COLUMN IF NOT EXISTS interview_score integer,
  ADD COLUMN IF NOT EXISTS missing_keywords text[],
  ADD COLUMN IF NOT EXISTS section_scores jsonb;

-- 2. recruiter_interview_sessions — tracks the full AI interview workflow
-- Each row = one interview session (internal or sent to candidate)
CREATE TABLE IF NOT EXISTS recruiter_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruiter_candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES recruiter_jobs(id) ON DELETE SET NULL,
  question_set_id uuid REFERENCES recruiter_question_sets(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'internal', -- 'internal' | 'sent_to_candidate'
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed'
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_score integer,
  recommendation text, -- 'Strong Hire' | 'Hire' | 'Consider' | 'Reject'
  strengths text[],
  weak_answers text[],
  evaluation_summary text,
  invite_token text UNIQUE DEFAULT gen_random_uuid()::text,
  invite_sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for recruiter_interview_sessions
ALTER TABLE recruiter_interview_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recruiter_interview_sessions'
    AND policyname = 'recruiter_interview_sessions_recruiter_access'
  ) THEN
    CREATE POLICY "recruiter_interview_sessions_recruiter_access"
      ON recruiter_interview_sessions
      FOR ALL
      USING (recruiter_id = auth.uid());
  END IF;
END $$;

-- Public read via invite token (for candidate self-interview link)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recruiter_interview_sessions'
    AND policyname = 'recruiter_interview_sessions_public_token_read'
  ) THEN
    CREATE POLICY "recruiter_interview_sessions_public_token_read"
      ON recruiter_interview_sessions
      FOR SELECT
      USING (invite_token IS NOT NULL);
  END IF;
END $$;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate ON recruiter_interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_recruiter ON recruiter_interview_sessions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_token ON recruiter_interview_sessions(invite_token);
