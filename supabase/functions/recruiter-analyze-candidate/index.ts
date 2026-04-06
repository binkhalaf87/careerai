import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const toolSchema = {
  type: "function" as const,
  function: {
    name: "submit_recruiter_report",
    description: "Return a strict recruiter-focused candidate evaluation report for hiring decisions.",
    parameters: {
      type: "object",
      properties: {
        executive_hiring_summary: {
          type: "object",
          properties: {
            candidate_level: { type: "string", description: "Junior / Mid / Senior / Lead" },
            best_fit_roles: { type: "array", items: { type: "string" }, description: "Specific role recommendations" },
            overall_fit_score: { type: "integer", description: "Overall fit score 0-100" },
            hiring_decision: { type: "string", enum: ["Strong Hire", "Consider", "Reject"] },
            summary: { type: "string", description: "2-3 line hiring summary" },
          },
          required: ["candidate_level", "best_fit_roles", "overall_fit_score", "hiring_decision", "summary"],
        },
        scoring_table: {
          type: "object",
          properties: {
            ats_compatibility: { type: "integer" },
            role_match: { type: "integer" },
            experience_depth: { type: "integer" },
            skill_relevance: { type: "integer" },
            career_progression: { type: "integer" },
          },
          required: ["ats_compatibility", "role_match", "experience_depth", "skill_relevance", "career_progression"],
        },
        strengths: { type: "array", items: { type: "string" }, description: "Max 5 specific strengths" },
        risks: { type: "array", items: { type: "string" }, description: "Max 5 direct risk flags" },
        missing_requirements: {
          type: "array",
          items: { type: "string" },
          description: "Role-critical missing requirements",
        },
        hiring_recommendation: {
          type: "object",
          properties: {
            decision: { type: "string", enum: ["Strong Hire", "Consider", "Reject"] },
            reasoning: { type: "string", description: "2-3 line reasoning" },
          },
          required: ["decision", "reasoning"],
        },
        interview_focus_areas: {
          type: "array",
          items: { type: "string" },
          description: "What the recruiter should validate in interview",
        },
        why_this_candidate: { type: "string", description: "Short explanation of why candidate is worth considering" },
        why_not_this_candidate: {
          type: "string",
          description: "Short explanation of why candidate should be rejected or questioned",
        },
      },
      required: [
        "executive_hiring_summary",
        "scoring_table",
        "strengths",
        "risks",
        "missing_requirements",
        "hiring_recommendation",
        "interview_focus_areas",
        "why_this_candidate",
        "why_not_this_candidate",
      ],
    },
  },
};

function deriveScore(report: any) {
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

function buildHtml(report: any, candidateName?: string, candidateTitle?: string) {
  const executive = report?.executive_hiring_summary || {};
  const scoring = report?.scoring_table || {};
  const recommendation = report?.hiring_recommendation || {};
  const strengths = toArray(report?.strengths || report?.top_strengths);
  const risks = toArray(report?.risks || report?.red_flags || report?.concerns);
  const missing = toArray(report?.missing_requirements || report?.missing_info);
  const focus = toArray(report?.interview_focus_areas || report?.interview_focus);
  const score = deriveScore(report);

  const renderList = (items: string[]) =>
    items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>No items</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Candidate AI Analysis</title>
  <style>body{font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}.wrap{max-width:960px;margin:0 auto}.hero,.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:16px}.hero h1{margin:0 0 6px;font-size:28px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.score{font-size:36px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e2e8f0;padding:10px 8px;font-size:14px}h2{font-size:18px;margin:0 0 12px}ul{margin:0;padding-left:20px}li{margin:8px 0}</style>
</head>
<body>
<div class="wrap">
<section class="hero">
<h1>${esc(candidateName || "Candidate")}</h1>
<p class="muted">${esc(candidateTitle || "—")}</p>
<div class="grid" style="margin-top:16px;">
<div><div class="muted">Latest Score</div><div class="score">${score ?? "—"}</div></div>
<div><div class="muted">Candidate Level</div><div>${esc(executive?.candidate_level || "—")}</div></div>
<div><div class="muted">Decision</div><div>${esc(recommendation?.decision || executive?.hiring_decision || report?.recommendation || "—")}</div></div>
</div></section>
<section class="card"><h2>Executive Summary</h2><p>${esc(executive?.summary || report?.executive_summary || "—")}</p></section>
<section class="card"><h2>Scoring Table</h2><table><tbody>
<tr><th>ATS Compatibility</th><td>${esc(scoring?.ats_compatibility ?? "—")}</td></tr>
<tr><th>Role Match</th><td>${esc(scoring?.role_match ?? "—")}</td></tr>
<tr><th>Experience Depth</th><td>${esc(scoring?.experience_depth ?? "—")}</td></tr>
<tr><th>Skill Relevance</th><td>${esc(scoring?.skill_relevance ?? "—")}</td></tr>
<tr><th>Career Progression</th><td>${esc(scoring?.career_progression ?? "—")}</td></tr>
</tbody></table></section>
<section class="grid">
<div class="card"><h2>Strengths</h2>${renderList(strengths)}</div>
<div class="card"><h2>Risks</h2>${renderList(risks)}</div>
<div class="card"><h2>Missing Requirements</h2>${renderList(missing)}</div>
<div class="card"><h2>Interview Focus Areas</h2>${renderList(focus)}</div>
</section></div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { candidateText, candidateName, candidateTitle, language } = await req.json();
    if (!candidateText) {
      return new Response(JSON.stringify({ error: "Missing candidateText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const lang = language === "ar" ? "Arabic" : "English";
    const systemPrompt = `You are a Senior Recruitment Manager, ATS Specialist, and enterprise hiring evaluator with 15+ years of experience in Saudi Arabia and GCC hiring markets.

Respond in ${lang}.

STRICT RULES:
- Think like a recruiter making a decision in under 2 minutes.
- Evaluate ONLY evidence present in the CV.
- DO NOT fabricate missing details.
- DO NOT give generic career advice.
- DO NOT repeat the same point in different wording.
- Keep insights recruiter-focused, direct, and action-oriented.
- Risks must be honest and critical when needed.
- Best fit roles must be specific, not broad.
- Missing requirements must be role-relevant.
- Interview focus areas must tell the recruiter what to validate.
- Use Saudi/GCC recruiter logic: stability, clarity, progression, role alignment, ATS readability, and business relevance.`;

    const userPrompt = `Analyze this candidate for a recruiter dashboard.

Candidate Name: ${candidateName || "Unknown"}
Current Title: ${candidateTitle || "Unknown"}

CV Content:
${String(candidateText).substring(0, 12000)}

Return a structured report with:
1) Executive Hiring Summary
2) Scoring Table (0-100)
3) Strengths (max 5)
4) Risks / Red Flags (max 5)
5) Missing Requirements
6) Hiring Recommendation with reasoning
7) Interview Focus Areas
8) Why this candidate?
9) Why NOT this candidate?

Make every point decision-supportive and recruiter-usable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "submit_recruiter_report" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const report = JSON.parse(toolCall.function.arguments);

    const html = buildHtml(report, candidateName, candidateTitle);
    const score = deriveScore(report);

    return new Response(JSON.stringify({ report, html, score, version: "recruiter-analysis-v1" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recruiter-analyze-candidate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


