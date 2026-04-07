/**
 * TALENTRY — Analysis Version Constants (Frontend copy)
 * ──────────────────────────────────────────────────────
 * Keep this in sync with:
 *   supabase/functions/_shared/versions.ts
 *
 * These values are written to the database on every analysis save so every
 * stored row is traceable back to the exact code that produced it.
 */

export const ANALYSIS_VERSIONS = {
  ANALYSIS_SCHEMA_VERSION: "2.1.0",
  PROMPT_VERSION:          "master-v3.0",
  NORMALIZER_VERSION:      "1.2.0",
  SCORE_ENGINE_VERSION:    "2.0.0",
} as const;

export type AnalysisVersions = typeof ANALYSIS_VERSIONS;
