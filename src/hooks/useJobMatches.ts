/**
 * TALENTRY — useJobMatches.ts
 *
 * All table/column names verified against actual Supabase schema.
 *
 * Exports:
 *   triggerMatchCalculation     – fire-and-forget (use after adding candidate/job)
 *   useRecalcMatches            – full UX state machine for the Refresh button
 *   useJobCandidateMatches      – matches for one job (JobCard panel)
 *   useCandidateJobMatches      – matches for one candidate (profile page)
 *   useRecruiterTopMatches      – top matches for dashboard
 *   matchScoreColor / Bg / Label / Bar / relativeTime  – display helpers
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobMatch {
  id: string;
  candidate_id: string;
  job_id: string;
  match_score: number;
  title_score: number;
  skills_score: number;
  experience_score: number;
  keyword_score: number;
  match_reasons: string[];
  is_stale?: boolean;
  updated_at?: string | null;
  // joined from recruiter_candidates
  candidate_name?: string;
  candidate_title?: string;
  candidate_stage?: string;
  candidate_email?: string;
  // joined from recruiter_jobs
  job_title?: string;
  job_department?: string;
  job_status?: string;
}

export interface RecalcResult {
  matches: number;
  message: string;
  duration_ms: number;
  scope: string;
}

export type RecalcStatus = "idle" | "loading" | "success" | "error";

// ─── Fire-and-forget trigger ─────────────────────────────────────────────────
// Call this from RecruiterCandidates after upload, and from RecruiterJobs after
// job create. Does not block UI.

export async function triggerMatchCalculation(opts?: {
  job_id?: string;
  candidate_id?: string;
  incremental?: boolean;
}): Promise<void> {
  try {
    await supabase.functions.invoke("calculate-matches", {
      body: {
        job_id: opts?.job_id,
        candidate_id: opts?.candidate_id,
        incremental: opts?.incremental ?? false,
      },
    });
  } catch (e) {
    console.warn("[triggerMatchCalculation] non-blocking failure:", e);
  }
}

// ─── useRecalcMatches — for the Refresh button ───────────────────────────────

export function useRecalcMatches() {
  const [status, setStatus] = useState<RecalcStatus>("idle");
  const [result, setResult] = useState<RecalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const recalculate = useCallback(async (opts?: { job_id?: string; candidate_id?: string }) => {
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("calculate-matches", {
        body: { job_id: opts?.job_id, candidate_id: opts?.candidate_id, incremental: false },
      });
      if (fnError) throw new Error(fnError.message || "Edge function error");
      const res = data as RecalcResult;
      setResult(res);
      setStatus("success");
      setLastRun(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Recalculation failed");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  return { recalculate, status, result, error, lastRun, reset };
}

// ─── useJobCandidateMatches — JobCard candidate panel ────────────────────────

export function useJobCandidateMatches(jobId: string | undefined) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await (supabase as any)
        .from("recruiter_candidate_job_matches")
        .select(
          `
          id, candidate_id, job_id,
          match_score, title_score, skills_score, experience_score, keyword_score,
          match_reasons, updated_at,
          recruiter_candidates!inner (name, current_title, stage, email)
        `,
        )
        .eq("job_id", jobId)
        .order("match_score", { ascending: false })
        .limit(50);

      if (dbErr) throw dbErr;

      setMatches(
        (data || []).map((r: any) => ({
          id: r.id,
          candidate_id: r.candidate_id,
          job_id: r.job_id,
          match_score: r.match_score,
          title_score: r.title_score,
          skills_score: r.skills_score,
          experience_score: r.experience_score,
          keyword_score: r.keyword_score,
          match_reasons: r.match_reasons || [],
          updated_at: r.updated_at,
          candidate_name: r.recruiter_candidates?.name,
          candidate_title: r.recruiter_candidates?.current_title,
          candidate_stage: r.recruiter_candidates?.stage,
          candidate_email: r.recruiter_candidates?.email,
        })),
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  return { matches, loading, error, load };
}

// ─── useCandidateJobMatches — candidate profile page ─────────────────────────

export function useCandidateJobMatches(candidateId: string | undefined) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("recruiter_candidate_job_matches")
        .select(
          `
          id, candidate_id, job_id,
          match_score, title_score, skills_score, experience_score, keyword_score,
          match_reasons, updated_at,
          recruiter_jobs!inner (title, department, status)
        `,
        )
        .eq("candidate_id", candidateId)
        .order("match_score", { ascending: false });

      setMatches(
        (data || []).map((r: any) => ({
          id: r.id,
          candidate_id: r.candidate_id,
          job_id: r.job_id,
          match_score: r.match_score,
          title_score: r.title_score,
          skills_score: r.skills_score,
          experience_score: r.experience_score,
          keyword_score: r.keyword_score,
          match_reasons: r.match_reasons || [],
          updated_at: r.updated_at,
          job_title: r.recruiter_jobs?.title,
          job_department: r.recruiter_jobs?.department,
          job_status: r.recruiter_jobs?.status,
        })),
      );
    } catch (e) {
      console.error("[useCandidateJobMatches]", e);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  return { matches, loading, load };
}

// ─── useRecruiterTopMatches — dashboard ──────────────────────────────────────

export function useRecruiterTopMatches(userId: string | undefined) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("recruiter_candidate_job_matches")
        .select(
          `
          id, candidate_id, job_id,
          match_score, title_score, skills_score, experience_score, keyword_score,
          match_reasons, updated_at,
          recruiter_candidates!inner (name, current_title, stage, email),
          recruiter_jobs!inner (title, department, status)
        `,
        )
        .eq("recruiter_id", userId)
        .gte("match_score", 50)
        .order("match_score", { ascending: false })
        .limit(20);

      setMatches(
        (data || []).map((r: any) => ({
          id: r.id,
          candidate_id: r.candidate_id,
          job_id: r.job_id,
          match_score: r.match_score,
          title_score: r.title_score,
          skills_score: r.skills_score,
          experience_score: r.experience_score,
          keyword_score: r.keyword_score,
          match_reasons: r.match_reasons || [],
          updated_at: r.updated_at,
          candidate_name: r.recruiter_candidates?.name,
          candidate_title: r.recruiter_candidates?.current_title,
          candidate_stage: r.recruiter_candidates?.stage,
          candidate_email: r.recruiter_candidates?.email,
          job_title: r.recruiter_jobs?.title,
          job_department: r.recruiter_jobs?.department,
          job_status: r.recruiter_jobs?.status,
        })),
      );
    } catch (e) {
      console.error("[useRecruiterTopMatches]", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { matches, loading, load };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function matchScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-500";
}

export function matchScoreBg(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-blue-100 text-blue-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function matchScoreLabel(score: number | null, ar = false): string {
  if (score == null) return ar ? "غير محدد" : "N/A";
  if (score >= 80) return ar ? "ممتاز" : "Excellent";
  if (score >= 60) return ar ? "جيد" : "Good";
  if (score >= 40) return ar ? "متوسط" : "Fair";
  return ar ? "ضعيف" : "Weak";
}

export function matchBarColor(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-400";
}

export function relativeTime(date: Date | string | null, ar = false): string {
  if (!date) return ar ? "غير معروف" : "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return ar ? "منذ لحظات" : "Just now";
  if (seconds < 3600) return ar ? `منذ ${Math.floor(seconds / 60)} دقيقة` : `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return ar ? `منذ ${Math.floor(seconds / 3600)} ساعة` : `${Math.floor(seconds / 3600)}h ago`;
  return ar ? `منذ ${Math.floor(seconds / 86400)} يوم` : `${Math.floor(seconds / 86400)}d ago`;
}


