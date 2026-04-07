-- ═══════════════════════════════════════════════════════════════════════════════
-- TALENTRY — Analysis Schema Standardization
-- Migration: 20260407000002_analysis_versioning.sql
-- ───────────────────────────────────────────────────────────────────────────────
-- Goal: Add traceable versioning metadata to every analysis record so results
--       are comparable across Job Seeker and Recruiter flows, and across
--       different model/prompt/engine versions.
--
-- Strategy:
--   • ADD COLUMN IF NOT EXISTS on every change — safe against re-runs
--   • No existing columns are dropped or renamed
--   • No existing data is modified
--   • All new columns are nullable with sensible defaults so existing INSERT
--     statements that omit them continue to work without modification
--
-- New columns (both tables):
--   analysis_version        TEXT    — semantic version of the output schema
--   model_name              TEXT    — AI model used (e.g. "gpt-4o")
--   prompt_version          TEXT    — version tag of the master prompt
--   normalizer_version      TEXT    — version of resume-normalizer.ts
--   score_engine_version    TEXT    — version of ats-engine.ts
--   analysis_json           JSONB   — canonical full analysis object
--                                    (alias for full_analysis / analysis_json
--                                     that already exist — NOT a duplicate;
--                                     this column is the standardised name)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. analyses (Job Seeker flow) ────────────────────────────────────────────

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS analysis_version       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model_name             TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt_version         TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS normalizer_version     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_engine_version   TEXT    DEFAULT NULL;

-- "analysis_json" is the standardised canonical name.
-- "full_analysis" already exists (added in migration 20260314112923).
-- We add analysis_json as a GENERATED column that mirrors full_analysis so
-- existing code reading full_analysis keeps working, and new code can use
-- the standard name.
-- NOTE: Postgres GENERATED columns cannot reference other JSONB columns
-- directly in a simple expression without a function, so we use a real column
-- and keep them in sync via a trigger instead.
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS analysis_json          JSONB   DEFAULT NULL;

-- Trigger: keep analysis_json ↔ full_analysis in sync (write to either,
-- the other is updated automatically).
CREATE OR REPLACE FUNCTION public.sync_analyses_json()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If the caller wrote to full_analysis but not analysis_json, mirror it.
  IF NEW.full_analysis IS NOT NULL AND NEW.analysis_json IS NULL THEN
    NEW.analysis_json := NEW.full_analysis;
  END IF;
  -- If the caller wrote to analysis_json but not full_analysis, mirror it.
  IF NEW.analysis_json IS NOT NULL AND NEW.full_analysis IS NULL THEN
    NEW.full_analysis := NEW.analysis_json;
  END IF;
  -- If both are set and differ, analysis_json wins (it is the standard).
  IF NEW.analysis_json IS NOT NULL AND NEW.full_analysis IS NOT NULL
     AND NEW.analysis_json <> NEW.full_analysis THEN
    NEW.full_analysis := NEW.analysis_json;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_analyses_json ON public.analyses;
CREATE TRIGGER trg_sync_analyses_json
  BEFORE INSERT OR UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.sync_analyses_json();

-- Backfill existing rows: set analysis_json from full_analysis where missing
UPDATE public.analyses
SET analysis_json = full_analysis
WHERE analysis_json IS NULL AND full_analysis IS NOT NULL;

-- Index for fast version-filtered queries
CREATE INDEX IF NOT EXISTS idx_analyses_analysis_version
  ON public.analyses (analysis_version)
  WHERE analysis_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analyses_model_name
  ON public.analyses (model_name)
  WHERE model_name IS NOT NULL;

-- ── 2. candidate_analyses (Recruiter flow) ───────────────────────────────────

ALTER TABLE public.candidate_analyses
  ADD COLUMN IF NOT EXISTS analysis_version       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model_name             TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt_version         TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS normalizer_version     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_engine_version   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS overall_score          NUMERIC DEFAULT NULL;

-- "analysis_json" already exists in candidate_analyses (the original column name).
-- No action needed — it IS the standard column for this table.
-- We add overall_score as a convenience alias for score (which already exists).
-- Keep both: "score" for legacy reads, "overall_score" for standardised reads.
-- Sync them via trigger.
CREATE OR REPLACE FUNCTION public.sync_candidate_analyses_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.overall_score IS NOT NULL AND NEW.score IS NULL THEN
    NEW.score := NEW.overall_score;
  END IF;
  IF NEW.score IS NOT NULL AND NEW.overall_score IS NULL THEN
    NEW.overall_score := NEW.score;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_candidate_analyses_score ON public.candidate_analyses;
CREATE TRIGGER trg_sync_candidate_analyses_score
  BEFORE INSERT OR UPDATE ON public.candidate_analyses
  FOR EACH ROW EXECUTE FUNCTION public.sync_candidate_analyses_score();

-- Backfill overall_score from score
UPDATE public.candidate_analyses
SET overall_score = score
WHERE overall_score IS NULL AND score IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_analyses_analysis_version
  ON public.candidate_analyses (analysis_version)
  WHERE analysis_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_analyses_model_name
  ON public.candidate_analyses (model_name)
  WHERE model_name IS NOT NULL;

-- ── 3. recruiter_candidates cache columns ────────────────────────────────────
-- latest_analysis_version already exists. We add the other version fields to
-- the cache row so a dashboard query needs no join to know what generated the
-- latest analysis.

ALTER TABLE public.recruiter_candidates
  ADD COLUMN IF NOT EXISTS latest_model_name           TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latest_prompt_version       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latest_normalizer_version   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latest_score_engine_version TEXT DEFAULT NULL;

-- ── 4. Convenience view: unified analysis feed ───────────────────────────────
-- Provides a single SELECT surface for admin/analytics queries across both flows.
-- Read-only. Does not affect any existing INSERT/UPDATE paths.

CREATE OR REPLACE VIEW public.v_all_analyses AS
  -- Job Seeker analyses
  SELECT
    id,
    user_id,
    resume_id::text                           AS resume_ref,
    'job_seeker'                              AS flow,
    overall_score,
    analysis_version,
    model_name,
    prompt_version,
    normalizer_version,
    score_engine_version,
    COALESCE(analysis_json, full_analysis)    AS analysis_json,
    language,
    created_at
  FROM public.analyses

  UNION ALL

  -- Recruiter candidate analyses
  SELECT
    ca.id,
    rc.recruiter_id                           AS user_id,
    ca.resume_id::text                        AS resume_ref,
    'recruiter'                               AS flow,
    COALESCE(ca.overall_score, ca.score)      AS overall_score,
    ca.analysis_version,
    ca.model_name,
    ca.prompt_version,
    ca.normalizer_version,
    ca.score_engine_version,
    ca.analysis_json,
    NULL                                      AS language,
    ca.created_at
  FROM public.candidate_analyses ca
  JOIN public.recruiter_candidates rc ON rc.id = ca.candidate_id;

-- ── 5. Comments for documentation ────────────────────────────────────────────

COMMENT ON COLUMN public.analyses.analysis_version     IS 'Schema version of the NormalizedAnalysis output object (e.g. "2.0.0")';
COMMENT ON COLUMN public.analyses.model_name           IS 'OpenAI model used for AI Layer B (e.g. "gpt-4o")';
COMMENT ON COLUMN public.analyses.prompt_version       IS 'Version tag of supabase/functions/_shared/analysis-core.ts buildPrompt()';
COMMENT ON COLUMN public.analyses.normalizer_version   IS 'Version tag of supabase/functions/_shared/resume-normalizer.ts';
COMMENT ON COLUMN public.analyses.score_engine_version IS 'Version tag of supabase/functions/_shared/ats-engine.ts';
COMMENT ON COLUMN public.analyses.analysis_json        IS 'Canonical full analysis object — mirrors full_analysis (kept for backward compat)';

COMMENT ON COLUMN public.candidate_analyses.analysis_version     IS 'Schema version of the NormalizedAnalysis output object';
COMMENT ON COLUMN public.candidate_analyses.model_name           IS 'OpenAI model used for AI Layer B';
COMMENT ON COLUMN public.candidate_analyses.prompt_version       IS 'Version tag of buildPrompt()';
COMMENT ON COLUMN public.candidate_analyses.normalizer_version   IS 'Version tag of resume-normalizer.ts';
COMMENT ON COLUMN public.candidate_analyses.score_engine_version IS 'Version tag of ats-engine.ts';
COMMENT ON COLUMN public.candidate_analyses.overall_score        IS 'Standardised score column — mirrors score (kept for backward compat)';
