import { supabase } from "@/integrations/supabase/client";
import { ANALYSIS_VERSIONS } from "@/lib/analysisVersions";
import { mapAnalysisResponse, deriveMappedScore } from "@/lib/analysisMapper";

export const CANDIDATE_ANALYSIS_VERSION = "recruiter-analysis-v1";

export interface CandidateAnalysisPayload {
  report: any;
  html: string;
  score: number | null;
  version: string;
}

export interface CandidateAnalysisHistoryItem {
  id: string;
  candidate_id: string;
  resume_id: string | null;
  analysis_html: string | null;
  analysis_json: any;
  score: number | null;
  // Standardised alias for score (mirrors score via DB trigger)
  overall_score: number | null;
  analysis_type: string | null;
  // Versioning metadata — null on rows created before this migration
  analysis_version: string | null;
  model_name: string | null;
  prompt_version: string | null;
  normalizer_version: string | null;
  score_engine_version: string | null;
  created_at: string;
  created_by: string | null;
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** @deprecated Use mapAnalysisResponse + deriveMappedScore instead */
export function deriveAnalysisScore(report: any): number | null {
  return deriveMappedScore(mapAnalysisResponse(report));
}

export function buildAnalysisHtml(
  report: any,
  options?: { candidateName?: string | null; candidateTitle?: string | null },
) {
  const candidateName = options?.candidateName || "Candidate";
  const candidateTitle = options?.candidateTitle || "—";
  const mapped = mapAnalysisResponse(report);
  const executive = (report?.executive_hiring_summary || {}) as Record<string, unknown>;
  const scoring = (report?.scoring_table || {}) as Record<string, unknown>;
  const recommendation = (report?.hiring_recommendation || {}) as Record<string, unknown>;
  const strengths = mapped.strengths;
  const risks = mapped.weaknesses;
  const missing = mapped.missing_requirements;
  const focus = mapped.interview_focus_areas;
  const score = mapped.overall_score > 0 ? mapped.overall_score : null;

  const renderList = (items: string[]) =>
    items.length
      ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : `<p class="empty">No items</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Candidate AI Analysis</title>
  <style>
    body { font-family: Segoe UI, Tahoma, Arial, sans-serif; background:#f8fafc; color:#0f172a; margin:0; padding:24px; }
    .wrap { max-width:960px; margin:0 auto; }
    .hero, .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:16px; }
    .hero h1 { margin:0 0 6px; font-size:28px; }
    .muted { color:#64748b; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:12px; }
    .score { font-size:36px; font-weight:700; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; border-bottom:1px solid #e2e8f0; padding:10px 8px; font-size:14px; }
    h2 { font-size:18px; margin:0 0 12px; }
    ul { margin:0; padding-left:20px; }
    li { margin:8px 0; }
    .empty { color:#94a3b8; margin:0; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>${esc(candidateName)}</h1>
      <p class="muted">${esc(candidateTitle)}</p>
      <div class="grid" style="margin-top:16px;">
        <div>
          <div class="muted">Latest Score</div>
          <div class="score">${score ?? "—"}</div>
        </div>
        <div>
          <div class="muted">Candidate Level</div>
          <div>${esc(executive?.candidate_level || "—")}</div>
        </div>
        <div>
          <div class="muted">Decision</div>
          <div>${esc(recommendation?.decision || executive?.hiring_decision || report?.recommendation || "—")}</div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Executive Summary</h2>
      <p>${esc(executive?.summary || report?.executive_summary || "—")}</p>
    </section>

    <section class="card">
      <h2>Scoring Table</h2>
      <table>
        <tbody>
          <tr><th>ATS Compatibility</th><td>${esc(scoring?.ats_compatibility ?? "—")}</td></tr>
          <tr><th>Role Match</th><td>${esc(scoring?.role_match ?? "—")}</td></tr>
          <tr><th>Experience Depth</th><td>${esc(scoring?.experience_depth ?? "—")}</td></tr>
          <tr><th>Skill Relevance</th><td>${esc(scoring?.skill_relevance ?? "—")}</td></tr>
          <tr><th>Career Progression</th><td>${esc(scoring?.career_progression ?? "—")}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="grid">
      <div class="card"><h2>Strengths</h2>${renderList(strengths)}</div>
      <div class="card"><h2>Risks</h2>${renderList(risks)}</div>
      <div class="card"><h2>Missing Requirements</h2>${renderList(missing)}</div>
      <div class="card"><h2>Interview Focus Areas</h2>${renderList(focus)}</div>
    </section>
  </div>
</body>
</html>`;
}

export async function generateCandidateAnalysis(args: {
  candidateText: string;
  candidateName?: string | null;
  candidateTitle?: string | null;
  language?: string;
}) {
  const { data, error } = await supabase.functions.invoke("recruiter-analyze-candidate", {
    body: {
      candidateText: args.candidateText,
      candidateName: args.candidateName,
      candidateTitle: args.candidateTitle,
      language: args.language || "en",
    },
  });

  if (error) throw error;

  const report = data?.report || data;
  const html =
    data?.html || buildAnalysisHtml(report, { candidateName: args.candidateName, candidateTitle: args.candidateTitle });
  const score = data?.score ?? deriveAnalysisScore(report);
  const version = data?.version || CANDIDATE_ANALYSIS_VERSION;

  return { report, html, score, version } satisfies CandidateAnalysisPayload;
}

export async function persistCandidateAnalysis(args: {
  candidateId: string;
  recruiterId: string;
  resumeId?: string | null;
  analysis: CandidateAnalysisPayload;
  analysisType?: string;
}) {
  const analysisType = args.analysisType || "manual_refresh";
  const report = args.analysis.report;
  const _mapped = mapAnalysisResponse(report);
  const atsScore = _mapped.overall_score || 0;
  const fitScore = _mapped.overall_score || Number(args.analysis.score) || 0;
  const fitLabel = _mapped.hiring_decision || null;

  const historyInsert = {
    candidate_id: args.candidateId,
    resume_id: args.resumeId || null,
    analysis_html: args.analysis.html,
    // ── Canonical analysis object ──────────────────────────────────────────
    analysis_json: report,
    // ── Score (both column names kept for compat) ──────────────────────────
    score: args.analysis.score,
    overall_score: args.analysis.score,
    analysis_type: analysisType,
    created_by: args.recruiterId,
    // ── Versioning metadata ────────────────────────────────────────────────
    analysis_version:     ANALYSIS_VERSIONS.ANALYSIS_SCHEMA_VERSION,
    model_name:           "gpt-4o",
    prompt_version:       ANALYSIS_VERSIONS.PROMPT_VERSION,
    normalizer_version:   ANALYSIS_VERSIONS.NORMALIZER_VERSION,
    score_engine_version: ANALYSIS_VERSIONS.SCORE_ENGINE_VERSION,
  };

  const { error: historyError } = await supabase.from("candidate_analyses").insert(historyInsert);
  if (historyError) throw historyError;

  const { error: candidateError } = await supabase
    .from("recruiter_candidates")
    .update({
      ai_report: report,
      fit_score: Number.isFinite(fitScore) ? Math.round(fitScore) : null,
      fit_label: fitLabel,
      ats_score: Number.isFinite(atsScore) ? Math.round(atsScore) : null,
      latest_analysis_html: args.analysis.html,
      latest_analysis_json: report,
      latest_analysis_score: args.analysis.score,
      latest_analysis_at: new Date().toISOString(),
      // ── Versioning metadata on cache row ──────────────────────────────────
      latest_analysis_version:        ANALYSIS_VERSIONS.ANALYSIS_SCHEMA_VERSION,
      latest_model_name:              "gpt-4o",
      latest_prompt_version:          ANALYSIS_VERSIONS.PROMPT_VERSION,
      latest_normalizer_version:      ANALYSIS_VERSIONS.NORMALIZER_VERSION,
      latest_score_engine_version:    ANALYSIS_VERSIONS.SCORE_ENGINE_VERSION,
    } as any)
    .eq("id", args.candidateId)
    .eq("recruiter_id", args.recruiterId);

  if (candidateError) throw candidateError;
}

export async function generateAndPersistCandidateAnalysis(args: {
  candidateId: string;
  recruiterId: string;
  resumeId?: string | null;
  candidateText: string;
  candidateName?: string | null;
  candidateTitle?: string | null;
  language?: string;
  analysisType?: string;
}) {
  const analysis = await generateCandidateAnalysis({
    candidateText: args.candidateText,
    candidateName: args.candidateName,
    candidateTitle: args.candidateTitle,
    language: args.language,
  });

  await persistCandidateAnalysis({
    candidateId: args.candidateId,
    recruiterId: args.recruiterId,
    resumeId: args.resumeId,
    analysis,
    analysisType: args.analysisType,
  });

  return analysis;
}

export async function loadCandidateAnalysisHistory(candidateId: string) {
  const { data, error } = await supabase
    .from("candidate_analyses")
    .select("id, candidate_id, resume_id, analysis_html, analysis_json, score, overall_score, analysis_type, analysis_version, model_name, prompt_version, normalizer_version, score_engine_version, created_at, created_by")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CandidateAnalysisHistoryItem[];
}


