import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// ─── Types ───────────────────────────────────────────────────
type JsonRecord = Record<string, unknown>;

const SECTION_KEYS = [
  "name",
  "job_title",
  "contact",
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
] as const;

interface AnalysisContext {
  weaknesses?: string[];
  suggestions?: string[];
  strengths?: string[];
  sectionScores?: Record<string, number>;
  atsBreakdown?: Record<string, { score: number; problem?: string; recommended_improvement?: string }>;
  quickImprovements?: { priority: string; description: string; action_step: string }[];
  careerRecommendations?: {
    skills_to_improve?: string[];
    certifications_recommended?: string[];
  };
  overallScore?: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeToText(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (isPlainObject(value)) {
    const preferredOrder = [
      "title",
      "name",
      "role",
      "company",
      "institution",
      "date",
      "period",
      "description",
      "details",
    ];
    const preferred = preferredOrder.map((k) => normalizeToText(value[k])).filter(Boolean);
    const fallback = Object.values(value)
      .map((v) => normalizeToText(v))
      .filter(Boolean);
    return (preferred.length ? preferred : fallback).join("\n").trim();
  }

  return "";
}

function normalizeStructuredResume(value: unknown): JsonRecord {
  if (!isPlainObject(value)) return {};
  const normalized: JsonRecord = {};
  for (const [key, raw] of Object.entries(value)) {
    normalized[key] = normalizeToText(raw);
  }
  return normalized;
}

// ─── Auth helper ─────────────────────────────────────────────
async function requireUser(authHeader: string | null) {
  if (!authHeader) throw new Error("Unauthorized");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

// ─── Build analysis-aware prompt blocks ──────────────────────
function buildAnalysisBlock(ctx: AnalysisContext): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════");
  lines.push("PREVIOUS CV ANALYSIS RESULTS (USE THESE TO GUIDE YOUR REWRITE)");
  lines.push("═══════════════════════════════════════");

  if (ctx.overallScore !== undefined) {
    lines.push(`\nCurrent ATS Score: ${ctx.overallScore}/100`);
    lines.push(`Goal: Improve this score significantly by addressing every issue below.`);
  }

  // Section scores — identify the weakest ones
  if (ctx.sectionScores && Object.keys(ctx.sectionScores).length > 0) {
    const sorted = Object.entries(ctx.sectionScores)
      .filter(([, s]) => typeof s === "number")
      .sort((a, b) => a[1] - b[1]);
    const weak = sorted.filter(([, s]) => s < 70);
    if (weak.length > 0) {
      lines.push("\nWEAKEST SECTIONS (prioritize improving these):");
      weak.forEach(([key, score]) => {
        lines.push(`  • ${key.replace(/_/g, " ")}: ${score}/100 — needs significant improvement`);
      });
    }
  }

  // Weaknesses
  if (ctx.weaknesses && ctx.weaknesses.length > 0) {
    lines.push("\nIDENTIFIED WEAKNESSES (must address each one in the rewrite):");
    ctx.weaknesses.forEach((w) => lines.push(`  ✗ ${w}`));
  }

  // ATS Breakdown — detailed per-section problems + recommended fixes
  if (ctx.atsBreakdown && Object.keys(ctx.atsBreakdown).length > 0) {
    const weakSections = Object.entries(ctx.atsBreakdown)
      .filter(([, data]) => data.score < 75)
      .sort((a, b) => a[1].score - b[1].score);

    if (weakSections.length > 0) {
      lines.push("\nDETAILED ATS ISSUES & REQUIRED FIXES:");
      weakSections.forEach(([section, data]) => {
        lines.push(`\n  [${section.replace(/_/g, " ").toUpperCase()}] — Score: ${data.score}/100`);
        if (data.problem) lines.push(`    Problem: ${data.problem}`);
        if (data.recommended_improvement) lines.push(`    Fix: ${data.recommended_improvement}`);
      });
    }
  }

  // Quick improvements (sorted by priority)
  if (ctx.quickImprovements && ctx.quickImprovements.length > 0) {
    const high = ctx.quickImprovements.filter((q) => q.priority === "high" || q.priority === "عالية");
    const others = ctx.quickImprovements.filter((q) => q.priority !== "high" && q.priority !== "عالية");
    const ordered = [...high, ...others];

    lines.push("\nPRIORITY IMPROVEMENTS TO IMPLEMENT:");
    ordered.slice(0, 8).forEach((q) => {
      lines.push(`  [${q.priority.toUpperCase()}] ${q.description}`);
      if (q.action_step) lines.push(`    → ${q.action_step}`);
    });
  }

  // Career recommendations — skills to add/highlight
  if (ctx.careerRecommendations) {
    const { skills_to_improve = [], certifications_recommended = [] } = ctx.careerRecommendations;
    if (skills_to_improve.length > 0) {
      lines.push("\nSKILLS TO HIGHLIGHT (if present in the original resume, make them prominent):");
      skills_to_improve.forEach((s) => lines.push(`  • ${s}`));
    }
    if (certifications_recommended.length > 0) {
      lines.push("\nCERTIFICATIONS TO MENTION (only if already present in the resume):");
      certifications_recommended.forEach((c) => lines.push(`  • ${c}`));
    }
  }

  // Suggestions
  if (ctx.suggestions && ctx.suggestions.length > 0) {
    lines.push("\nADDITIONAL SUGGESTIONS FROM ANALYSIS:");
    ctx.suggestions.slice(0, 5).forEach((s) => lines.push(`  • ${s}`));
  }

  lines.push("\n═══════════════════════════════════════");
  lines.push("CRITICAL: The rewrite MUST visibly address ALL the issues above.");
  lines.push("Do NOT produce a generic improvement — fix each specific problem identified.");
  lines.push("═══════════════════════════════════════");

  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await requireUser(req.headers.get("Authorization"));

    const {
      resumeText,
      structuredResume,
      targetJobTitle,
      targetJobDescription,
      weaknesses,
      analysisContext,
      language,
      tone,
      focus,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isArabic = language === "ar";
    const normalizedStructuredResume = normalizeStructuredResume(structuredResume);

    // Build resume context
    let resumeContext = "";
    if (Object.keys(normalizedStructuredResume).length) {
      resumeContext = Object.entries(normalizedStructuredResume)
        .filter(([, v]) => typeof v === "string" && (v as string).trim())
        .map(([k, v]) => `### ${k}\n${v}`)
        .join("\n\n");
    }
    const fallbackResumeText = normalizeToText(resumeText);
    if (!resumeContext && fallbackResumeText) resumeContext = fallbackResumeText;
    if (!resumeContext) return json({ error: "No resume data provided" }, 400);

    // ── Build analysis block (new — replaces simple weaknesses list) ──
    let analysisBlock = "";
    const ctx = analysisContext as AnalysisContext | null | undefined;

    if (ctx && typeof ctx === "object") {
      // Merge any top-level weaknesses array into the context
      if (Array.isArray(weaknesses) && weaknesses.length > 0) {
        const merged: AnalysisInsightLocal = {
          ...ctx,
          weaknesses: [
            ...new Set(
              [...(ctx.weaknesses || []).map(normalizeToText), ...weaknesses.map(normalizeToText)].filter(Boolean),
            ),
          ],
        };
        analysisBlock = buildAnalysisBlock(merged);
      } else {
        analysisBlock = buildAnalysisBlock(ctx);
      }
    } else if (Array.isArray(weaknesses) && weaknesses.length > 0) {
      // Legacy: only weaknesses array provided
      const normalizedWeaknesses = weaknesses.map((w) => normalizeToText(w)).filter(Boolean);
      analysisBlock = [
        "PREVIOUS CV ANALYSIS — WEAKNESSES TO ADDRESS:",
        ...normalizedWeaknesses.map((w) => `  ✗ ${w}`),
        "\nThe rewrite MUST address every weakness above.",
      ].join("\n");
    }

    // Optional job block
    const normalizedJobTitle = normalizeToText(targetJobTitle);
    const normalizedJobDesc = normalizeToText(targetJobDescription);
    const jobBlock =
      normalizedJobTitle || normalizedJobDesc
        ? `\nTarget position:\n${normalizedJobTitle ? `Job Title: ${normalizedJobTitle}` : ""}${normalizedJobDesc ? `\nJob Description:\n${normalizedJobDesc}` : ""}`
        : "";

    const toneInstruction = normalizeToText(tone) ? `\n- Writing tone should be ${normalizeToText(tone)}` : "";
    const focusInstruction =
      Array.isArray(focus) && focus.length
        ? `\n- Give extra attention to these areas: ${focus
            .map((f) => normalizeToText(f))
            .filter(Boolean)
            .join(", ")}`
        : "";

    // ── System prompt ──
    const systemPrompt = `You are a senior ATS resume writer and professional CV strategist with 15+ years of experience.
Your task: Rewrite the resume into a HIGH-QUALITY, ATS-OPTIMIZED version.
Write ${isArabic ? "in Arabic" : "in English"}.${analysisBlock ? "\n\nYou have been provided with a detailed analysis of the current resume's weaknesses. Your rewrite MUST specifically fix every identified issue." : ""}

STRICT RULES (MANDATORY):
- DO NOT invent any experience, job titles, companies, dates, certifications, or skills not clearly present or implied
- DO NOT fabricate numbers or achievements
- DO NOT exaggerate beyond the source
- If information is missing, leave the field as an empty string
- The output language is ${isArabic ? "Arabic" : "English"} — write every field in ${isArabic ? "Arabic" : "English"}

WHAT YOU ARE ALLOWED TO DO:
- Improve wording, clarity, structure, and formatting
- Rewrite sentences professionally using STAR method where applicable
- Convert responsibilities into stronger impact statements WITHOUT adding fake data
- Improve ATS keyword alignment based on job description if provided
- Organize and categorize skills properly
- Fix every weakness identified in the analysis${jobBlock ? "\n- Tailor content towards the target position" : ""}${toneInstruction}${focusInstruction}

SKILLS SECTION RULE:
- Return skills as a clean bullet list (one skill per line starting with •)
- Do NOT write skills as a long paragraph

OUTPUT FORMAT (STRICT):
Return ONLY a valid JSON object with these exact keys: name, job_title, contact, summary, experience, skills, education, certifications, projects, languages.
Every value MUST be a plain string. No arrays, nested objects, or markdown.
No markdown fences, no explanation, no comments, no text outside JSON.`;

    const userPrompt = [
      "Here is the resume to rewrite:\n\n" + resumeContext,
      analysisBlock ? "\n\n" + analysisBlock : "",
      jobBlock ? "\n\n" + jobBlock : "",
    ].join("");

    // Call AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      if (response.status === 402) return json({ error: "Payment required. Please add credits." }, 402);
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const raw = aiResult.choices?.[0]?.message?.content || "";

    // Parse AI JSON response
    let rebuilt: JsonRecord;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      rebuilt = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", raw.slice(0, 500));
      return json({ error: "Failed to parse AI response" }, 500);
    }

    // Normalize ALL values
    const normalizedRebuilt: JsonRecord = {};
    for (const key of SECTION_KEYS) {
      normalizedRebuilt[key] = normalizeToText(rebuilt[key]);
    }

    // Validate skills — should not be a long paragraph
    const skillsText = normalizeToText(normalizedRebuilt.skills);
    if (skillsText && skillsText.split("\n").some((line) => line.length > 200)) {
      normalizedRebuilt.skills = normalizeToText(normalizedStructuredResume.skills);
    }

    // Validate summary length
    const summaryText = normalizeToText(normalizedRebuilt.summary);
    if (summaryText.length > 1200) {
      normalizedRebuilt.summary = summaryText.slice(0, 1200).trim();
    }

    // Reject if output too short
    const totalLen = Object.values(normalizedRebuilt)
      .map((v) => normalizeToText(v))
      .join("").length;
    if (totalLen < 100) {
      return json({ error: "AI produced insufficient output" }, 500);
    }

    // Fallback empty fields to original
    for (const key of SECTION_KEYS) {
      const rebuiltValue = normalizeToText(normalizedRebuilt[key]);
      const originalValue = normalizeToText(normalizedStructuredResume[key]);
      if (!rebuiltValue && originalValue) {
        normalizedRebuilt[key] = originalValue;
      }
    }

    return json({ rebuilt: normalizedRebuilt, model: "google/gemini-2.5-flash" });
  } catch (e) {
    console.error("improve-resume error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// Local type alias to avoid TS complaint inside the serve handler
type AnalysisInsightLocal = {
  weaknesses?: string[];
  suggestions?: string[];
  strengths?: string[];
  sectionScores?: Record<string, number>;
  atsBreakdown?: Record<string, { score: number; problem?: string; recommended_improvement?: string }>;
  quickImprovements?: { priority: string; description: string; action_step: string }[];
  careerRecommendations?: { skills_to_improve?: string[]; certifications_recommended?: string[] };
  overallScore?: number;
};


