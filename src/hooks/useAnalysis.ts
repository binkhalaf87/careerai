import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoredAnalysisRow {
  id: string;
  resume_id: string | null;
  overall_score: number | null;
  section_scores: Record<string, number> | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  suggestions: string[] | null;
  language: string | null;
  // Legacy column — still the primary full analysis store
  full_analysis: Record<string, unknown> | null;
  // Standardised alias (mirrors full_analysis via DB trigger)
  analysis_json: Record<string, unknown> | null;
  // Versioning metadata — null on rows created before this migration
  analysis_version: string | null;
  model_name: string | null;
  prompt_version: string | null;
  normalizer_version: string | null;
  score_engine_version: string | null;
  created_at?: string;
}

export function useAnalysis(resumeId?: string | null) {
  const [analysis, setAnalysis] = useState<StoredAnalysisRow | null>(null);
  const [loading, setLoading] = useState(Boolean(resumeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!resumeId) {
        setAnalysis(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("analyses")
          .select(
            "id, resume_id, overall_score, section_scores, strengths, weaknesses, suggestions, language, full_analysis, analysis_json, analysis_version, model_name, prompt_version, normalizer_version, score_engine_version, created_at",
          )
          .eq("resume_id", resumeId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;
        setAnalysis((data as StoredAnalysisRow | null) ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load analysis");
        setAnalysis(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [resumeId]);

  return { analysis, loading, error };
}


