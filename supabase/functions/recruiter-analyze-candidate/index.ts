/**
 * TALENTRY — Recruiter Candidate Analysis
 * ----------------------------------------
 * Wrapper around the shared analysis core.
 * Produces the SAME NormalizedAnalysis schema as the Job Seeker flow,
 * then additionally derives recruiter-specific convenience fields
 * (hiring_decision, scoring_table, html report) on top of it.
 *
 * Core analysis logic lives in: ../_shared/analysis-core.ts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callAnalysisAI,
  asString,
  clampScore,
  NormalizedAnalysis,
} from "../_shared/analysis-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Recruiter-specific derivations ────────────────────────────────────────────

/** Derive overall fit score from the unified analysis */
function deriveOverallScore(analysis: NormalizedAnalysis): number {
  return analysis.ats_score;
}

/** Map ats_score to a hiring decision string */
function deriveHiringDecision(score: number): "Strong Hire" | "Consider" | "Reject" {
  if (score >= 75) return "Strong Hire";
  if (score >= 50) return "Consider";
  return "Reject";
}

/** Build recruiter-specific scoring_table from section_scores */
function buildScoringTable(analysis: NormalizedAnalysis) {
  const s = analysis.section_scores;
  return {
    ats_compatibility: s.keyword_optimization,
    role_match: clampScore(
      Math.round((s.skills_relevance + s.keyword_optimization) / 2)
    ),
    experience_depth: s.experience_quality,
    skill_relevance: s.skills_relevance,
    career_progression: s.career_progression,
  };
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build HTML report from the unified analysis for the recruiter dashboard */
function buildHtml(
  analysis: NormalizedAnalysis,
  candidateName?: string,
  candidateTitle?: string
): string {
  const score = deriveOverallScore(analysis);
  const decision = deriveHiringDecision(score);
  const scoringTable = buildScoringTable(analysis);
  const ex = analysis.executive_summary;
  const rec = analysis.recruiter_analysis;

  const renderList = (items: string[]) =>
    items.length
      ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : `<p>No items</p>`;

  const scoreRows = Object.entries(scoringTable)
    .map(
      ([key, val]) =>
        `<tr><th>${esc(key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}</th><td>${esc(val)}</td></tr>`
    )
    .join("");

  const recruiterRows = Object.entries(rec)
    .map(
      ([key, val]: [string, any]) =>
        `<tr><th>${esc(key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}</th>` +
        `<td>${esc(val.score)}/100</td><td>${esc(val.comment)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recruiter Candidate Analysis</title>
  <style>
    body{font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}
    .wrap{max-width:960px;margin:0 auto}
    .hero,.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:16px}
    .hero h1{margin:0 0 6px;font-size:28px}
    .muted{color:#64748b}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .score{font-size:36px;font-weight:700}
    table{width:100%;border-collapse:collapse}
    th,td{text-align:left;border-bottom:1px solid #e2e8f0;padding:10px 8px;font-size:14px}
    h2{font-size:18px;margin:0 0 12px}
    ul{margin:0;padding-left:20px}
    li{margin:8px 0}
    .badge-hire{color:#16a34a;font-weight:600}
    .badge-consider{color:#d97706;font-weight:600}
    .badge-reject{color:#dc2626;font-weight:600}
  </style>
</head>
<body>
<div class="wrap">
  <section class="hero">
    <h1>${esc(candidateName || analysis.candidate_name || "Candidate")}</h1>
    <p class="muted">${esc(candidateTitle || analysis.target_role || "—")}</p>
    <div class="grid" style="margin-top:16px;">
      <div><div class="muted">ATS Score</div><div class="score">${score}</div></div>
      <div><div class="muted">Candidate Level</div><div>${esc(ex.candidate_level)}</div></div>
      <div><div class="muted">Decision</div>
        <div class="badge-${decision === "Strong Hire" ? "hire" : decision === "Consider" ? "consider" : "reject"}">${esc(decision)}</div>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Executive Summary</h2>
    <p>${esc(ex.summary_paragraphs)}</p>
  </section>

  <section class="card">
    <h2>Scoring Table</h2>
    <table><tbody>${scoreRows}</tbody></table>
  </section>

  <section class="card">
    <h2>Recruiter Analysis</h2>
    <table>
      <thead><tr><th>Dimension</th><th>Score</th><th>Comment</th></tr></thead>
      <tbody>${recruiterRows}</tbody>
    </table>
  </section>

  <section class="grid">
    <div class="card"><h2>Strengths</h2>${renderList(ex.top_strengths)}</div>
    <div class="card"><h2>Risks</h2>${renderList(ex.main_risks)}</div>
    <div class="card"><h2>Best Fit Roles</h2>${renderList(ex.best_fit_roles)}</div>
    <div class="card"><h2>Interview Focus Areas</h2>${renderList(
      analysis.interview_questions.slice(0, 5).map((q) => q.question)
    )}</div>
  </section>

  <section class="card">
    <h2>Recommended Improvements</h2>
    ${renderList(
      analysis.quick_improvements
        .filter((i) => i.priority === "high")
        .map((i) => i.description)
    )}
  </section>
</div>
</body>
</html>`;
}

// ── Serve ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const candidateText = asString(payload?.candidateText);
    const candidateName = asString(payload?.candidateName);
    const candidateTitle = asString(payload?.candidateTitle);
    const language = payload?.language === "ar" ? "ar" : "en";

    if (!candidateText || candidateText.length < 30) {
      return jsonResponse({ error: "Missing or too-short candidateText" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    // ── Run the SAME shared core analysis ────────────────────────────────────
    let result: Awaited<ReturnType<typeof callAnalysisAI>>;
    try {
      result = await callAnalysisAI({
        resumeText: candidateText,
        language,
        openAIApiKey: OPENAI_API_KEY,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return jsonResponse({ error: "AI analysis timed out" }, 504);
      }
      if (err?.status === 429) {
        return jsonResponse({ error: "Rate limited, please try again later" }, 429);
      }
      if (err?.status === 402) {
        return jsonResponse({ error: "Credits exhausted" }, 402);
      }
      throw err;
    }

    const { analysis } = result;
    const score = deriveOverallScore(analysis);
    const decision = deriveHiringDecision(score);
    const scoringTable = buildScoringTable(analysis);
    const html = buildHtml(analysis, candidateName, candidateTitle);

    // ── Return: unified analysis + recruiter convenience layer ────────────────
    return jsonResponse(
      {
        // ── Unified schema (identical to Job Seeker flow) ──
        ...analysis,

        // ── Recruiter-specific convenience fields ──────────
        score,
        hiring_decision: decision,
        scoring_table: scoringTable,
        executive_hiring_summary: {
          candidate_level: analysis.executive_summary.candidate_level,
          best_fit_roles: analysis.executive_summary.best_fit_roles,
          overall_fit_score: score,
          hiring_decision: decision,
          summary: analysis.executive_summary.summary_paragraphs,
        },
        strengths: analysis.executive_summary.top_strengths,
        risks: analysis.executive_summary.main_risks,
        missing_requirements: analysis.career_recommendations.skills_to_improve.slice(0, 5),
        hiring_recommendation: {
          decision,
          reasoning: analysis.executive_summary.summary_paragraphs.split("\n")[0] || "",
        },
        interview_focus_areas: analysis.interview_questions
          .slice(0, 5)
          .map((q) => q.question),
        why_this_candidate: analysis.executive_summary.top_strengths.join(" | "),
        why_not_this_candidate: analysis.executive_summary.main_risks.join(" | "),

        // ── HTML report for dashboard embedding ────────────
        html,

        version: "recruiter-analysis-v2-unified",
      },
      200
    );
  } catch (e) {
    console.error("recruiter-analyze-candidate error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
