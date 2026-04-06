import { supabase } from "@/integrations/supabase/client";

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
  analysis_type: string | null;
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

export function deriveAnalysisScore(report: any): number | null {
  const candidates = [
    report?.executive_hiring_summary?.overall_fit_score,
    report?.scoring_table?.role_match,
    report?.score,
    report?.scoring_table?.ats_compatibility,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  return null;
}

export function buildAnalysisHtml(
  report: any,
  options?: { candidateName?: string | null; candidateTitle?: string | null },
) {
  const candidateName = options?.candidateName || "Candidate";
  const candidateTitle = options?.candidateTitle || "—";
  const executive = report?.executive_hiring_summary || {};
  const scoring = report?.scoring_table || {};
  const recommendation = report?.hiring_recommendation || {};
  const strengths = toArray(report?.strengths || report?.top_strengths);
  const risks = toArray(report?.risks || report?.red_flags || report?.concerns);
  const missing = toArray(report?.missing_requirements || report?.missing_info);
  const focus = toArray(report?.interview_focus_areas || report?.interview_focus);
  const score = deriveAnalysisScore(report);

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
  const atsScore = Number(report?.scoring_table?.ats_compatibility);
  const fitScore = Number(
    report?.executive_hiring_summary?.overall_fit_score || report?.scoring_table?.role_match || args.analysis.score,
  );
  const fitLabel =
    report?.hiring_recommendation?.decision ||
    report?.executive_hiring_summary?.hiring_decision ||
    report?.recommendation ||
    null;

  const historyInsert = {
    candidate_id: args.candidateId,
    resume_id: args.resumeId || null,
    analysis_html: args.analysis.html,
    analysis_json: report,
    score: args.analysis.score,
    analysis_type: analysisType,
    created_by: args.recruiterId,
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
      latest_analysis_version: args.analysis.version,
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
    .select("id, candidate_id, resume_id, analysis_html, analysis_json, score, analysis_type, created_at, created_by")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CandidateAnalysisHistoryItem[];
}
