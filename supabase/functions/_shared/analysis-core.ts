/**
 * TALENTRY — Shared Resume Analysis Core
 * ----------------------------------------
 * Single source of truth for:
 *   - toolSchema (OpenAI function schema)
 *   - normalizeAnalysis()
 *   - buildPrompt()
 *   - callAnalysisAI()
 *   - Helper utilities: clampScore, asString, asStringArray,
 *     getMessageContentAsText, tryExtractJsonFromText
 *
 * Used by:
 *   - supabase/functions/analyze-resume/index.ts       (Job Seeker flow)
 *   - supabase/functions/recruiter-analyze-candidate/index.ts (Recruiter flow)
 */

import { normalizeResumeText, prepareTextForPrompt } from "./resume-normalizer.ts";
import { computeAtsScores, DeterministicScores } from "./ats-engine.ts";
import { validateAiOutput, buildRetryPrefix, VALIDATION } from "./output-validator.ts";

// ─── Official analysis model ──────────────────────────────────────────────────
// Change this ONE constant to update the model for ALL resume analysis flows.
// Do NOT hardcode a model string anywhere else in this file or in wrapper functions.

export const ANALYSIS_MODEL = "gemini-2.5-flash" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectionScores {
  resume_formatting: number;
  keyword_optimization: number;
  experience_quality: number;
  career_progression: number;
  skills_relevance: number;
  education_strength: number;
  contact_information_quality: number;
}

export interface AtsBreakdownItem {
  score: number;
  current_state: string;
  problem: string;
  recommended_improvement: string;
}

export interface AtsBreakdown {
  formatting: AtsBreakdownItem;
  sections: AtsBreakdownItem;
  keywords: AtsBreakdownItem;
  experience: AtsBreakdownItem;
  education: AtsBreakdownItem;
  skills: AtsBreakdownItem;
  contact_info: AtsBreakdownItem;
}

export interface RecruiterAnalysisItem {
  score: number;
  comment: string;
}

export interface NormalizedAnalysis {
  target_role: string;
  candidate_name: string;
  ats_score: number;
  section_scores: SectionScores;
  executive_summary: {
    candidate_level: "junior" | "mid" | "senior" | "executive";
    summary_paragraphs: string;
    best_fit_roles: string[];
    top_strengths: string[];
    main_risks: string[];
  };
  ats_breakdown: AtsBreakdown;
  recruiter_analysis: {
    first_impression: RecruiterAnalysisItem;
    career_clarity: RecruiterAnalysisItem;
    achievement_strength: RecruiterAnalysisItem;
    role_alignment: RecruiterAnalysisItem;
    professional_presentation: RecruiterAnalysisItem;
  };
  career_recommendations: {
    top_roles: { role: string; why_it_fits: string }[];
    skills_to_improve: string[];
    thirty_sixty_ninety_day_plan: {
      thirty_days: string;
      sixty_days: string;
      ninety_days: string;
    };
    certifications_recommended: string[];
    linkedin_improvements: string;
  };
  salary_estimation: {
    salary_table: {
      role: string;
      monthly_range_low: number;
      monthly_range_high: number;
      when_upper_range: string;
      notes: string;
    }[];
    offer_range_low: number;
    offer_range_high: number;
    negotiation_target: number;
    anchor: number;
    walk_away: number;
  };
  resume_rewrite: { full_resume: string };
  quick_improvements: { priority: "high" | "medium" | "low"; description: string; action_step: string }[];
  interview_questions: { question: string; suggested_answer_direction: string }[];
}

// ─── OpenAI tool schema (shared) ─────────────────────────────────────────────

export const toolSchema = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit AI qualitative insights only. Do NOT include any numeric scores — those are computed separately by the ATS engine.",
    parameters: {
      type: "object",
      properties: {
        // ── Identity (needed since AI reads the resume) ────────────────────
        target_role: {
          type: "string",
          description: "Inferred or stated target role — most competitive for this candidate in GCC",
        },
        candidate_name: {
          type: "string",
          description: "Full name extracted from resume header. '[Please confirm]' if absent.",
        },

        // ── Executive narrative ─────────────────────────────────────────────
        executive_summary: {
          type: "object",
          properties: {
            candidate_level: {
              type: "string",
              enum: ["junior", "mid", "senior", "executive"],
              description: "Seniority level — AI infers from context; ATS engine may override based on years.",
            },
            summary_paragraphs: {
              type: "string",
              description: "3 paragraphs: overall impression, value proposition, critical gaps. No generic openers.",
            },
            best_fit_roles: {
              type: "array",
              items: { type: "string" },
              description: "3–5 specific role titles (seniority + function + domain). No vague titles.",
            },
            top_strengths: {
              type: "array",
              items: { type: "string" },
              description: "Exactly 3. Each: [Strength]: [Evidence from resume] → [GCC hiring relevance]",
            },
            main_risks: {
              type: "array",
              items: { type: "string" },
              description: "Exactly 3. Each: [Risk]: [Evidence of problem] → [Recruiter impact]",
            },
          },
          required: ["candidate_level", "summary_paragraphs", "best_fit_roles", "top_strengths", "main_risks"],
          additionalProperties: false,
        },

        // ── ATS breakdown narratives ONLY (no score fields) ────────────────
        ats_breakdown_narratives: {
          type: "object",
          description: "Qualitative commentary on each ATS dimension. Numeric scores are computed by the engine — do NOT include score fields here.",
          properties: {
            formatting: {
              type: "object",
              properties: {
                current_state: { type: "string", description: "One sentence: what is present in the resume formatting right now." },
                problem: { type: "string", description: "Specific ATS problem caused. For keywords: list top 5 missing by name." },
                recommended_improvement: { type: "string", description: "One imperative sentence with the exact fix." },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            sections: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            keywords: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string", description: "MUST list specific missing ATS keywords by name." },
                recommended_improvement: { type: "string", description: "Name exact keywords and the exact section to add them to." },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            experience: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            education: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            skills: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            contact_info: {
              type: "object",
              properties: {
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
          },
          required: ["formatting", "sections", "keywords", "experience", "education", "skills", "contact_info"],
          additionalProperties: false,
        },

        // ── Recruiter analysis (comments only, no score fields) ───────────
        recruiter_analysis_comments: {
          type: "object",
          description: "Recruiter perspective narratives. No numeric scores — computed by ATS engine.",
          properties: {
            first_impression: { type: "string", description: "What a GCC recruiter thinks in first 6 seconds. Min 2 sentences citing resume content." },
            career_clarity: { type: "string", description: "Is professional direction clear and consistent? Min 2 sentences." },
            achievement_strength: { type: "string", description: "Are achievements quantified and impactful vs. duty-listing? Min 2 sentences." },
            role_alignment: { type: "string", description: "Does resume feel purpose-built or generic? Min 2 sentences." },
            professional_presentation: { type: "string", description: "Grammar, tone, formatting consistency. Min 2 sentences." },
          },
          required: ["first_impression", "career_clarity", "achievement_strength", "role_alignment", "professional_presentation"],
          additionalProperties: false,
        },

        // ── Career recommendations ────────────────────────────────────────
        career_recommendations: {
          type: "object",
          properties: {
            top_roles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  why_it_fits: { type: "string", description: "2 sentences citing resume evidence." },
                },
                required: ["role", "why_it_fits"],
                additionalProperties: false,
              },
            },
            skills_to_improve: {
              type: "array",
              items: { type: "string" },
              description: "5–8 specific tools/certs/methodologies. Format: 'Skill — reason for GCC market'",
            },
            thirty_sixty_ninety_day_plan: {
              type: "object",
              properties: {
                thirty_days: { type: "string" },
                sixty_days: { type: "string" },
                ninety_days: { type: "string" },
              },
              required: ["thirty_days", "sixty_days", "ninety_days"],
              additionalProperties: false,
            },
            certifications_recommended: {
              type: "array",
              items: { type: "string" },
              description: "3–5 certs with issuing body. e.g. 'PMP — Project Management Institute'",
            },
            linkedin_improvements: {
              type: "string",
              description: "3–5 specific LinkedIn section changes.",
            },
          },
          required: ["top_roles", "skills_to_improve", "thirty_sixty_ninety_day_plan", "certifications_recommended", "linkedin_improvements"],
          additionalProperties: false,
        },

        // ── Salary estimation ─────────────────────────────────────────────
        salary_estimation: {
          type: "object",
          properties: {
            salary_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  monthly_range_low: { type: "number" },
                  monthly_range_high: { type: "number" },
                  when_upper_range: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["role", "monthly_range_low", "monthly_range_high", "when_upper_range", "notes"],
                additionalProperties: false,
              },
            },
            offer_range_low: { type: "number" },
            offer_range_high: { type: "number" },
            negotiation_target: { type: "number" },
            anchor: { type: "number" },
            walk_away: { type: "number" },
          },
          required: ["salary_table", "offer_range_low", "offer_range_high", "negotiation_target", "anchor", "walk_away"],
          additionalProperties: false,
        },

        // ── Resume rewrite ────────────────────────────────────────────────
        resume_rewrite: {
          type: "object",
          properties: {
            full_resume: { type: "string", description: "Complete ATS-optimized English resume. No invented information." },
          },
          required: ["full_resume"],
          additionalProperties: false,
        },

        // ── Improvements ──────────────────────────────────────────────────
        quick_improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              description: { type: "string" },
              action_step: { type: "string" },
            },
            required: ["priority", "description", "action_step"],
            additionalProperties: false,
          },
        },

        // ── Interview questions ───────────────────────────────────────────
        interview_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              suggested_answer_direction: { type: "string" },
            },
            required: ["question", "suggested_answer_direction"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "target_role",
        "candidate_name",
        "executive_summary",
        "ats_breakdown_narratives",
        "recruiter_analysis_comments",
        "career_recommendations",
        "salary_estimation",
        "resume_rewrite",
        "quick_improvements",
        "interview_questions",
      ],
      additionalProperties: false,
    },
  },
};

// ─── Helper utilities ─────────────────────────────────────────────────────────

export function clampScore(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function getMessageContentAsText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return asString((part as any).text);
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function truncateForLog(value: string, max = 2000): string {
  const text = asString(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...[truncated ${text.length - max} chars]` : text;
}

function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function extractBalancedJsonObject(content: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return content.slice(start, i + 1);
      }
    }
  }

  return null;
}

function sanitizeJsonLikeText(content: string): string {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/^json\s*/i, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function tryParseJsonCandidate(content: string): any | null {
  const candidate = sanitizeJsonLikeText(stripMarkdownCodeFences(content));
  if (!candidate) return null;

  const attempts = [candidate];
  const balanced = extractBalancedJsonObject(candidate);
  if (balanced && balanced !== candidate) attempts.push(balanced);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Continue to the next parse strategy.
    }
  }

  return null;
}

export function tryExtractJsonFromText(content: string): any | null {
  return tryParseJsonCandidate(content);
}

function getGeminiCandidateText(data: any): string {
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];

  return parts
    .map((part: any) => asString(part?.text))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function describeAnalysisShape(analysis: NormalizedAnalysis): string {
  return JSON.stringify({
    target_role: analysis.target_role,
    candidate_name: analysis.candidate_name,
    ats_score: analysis.ats_score,
    best_fit_roles_count: analysis.executive_summary.best_fit_roles.length,
    strengths_count: analysis.executive_summary.top_strengths.length,
    risks_count: analysis.executive_summary.main_risks.length,
    salary_rows: analysis.salary_estimation.salary_table.length,
    quick_improvements_count: analysis.quick_improvements.length,
    interview_questions_count: analysis.interview_questions.length,
    rewrite_words: analysis.resume_rewrite.full_resume.split(/\s+/).filter(Boolean).length,
  });
}

function logFinalAnalysis(label: string, analysis: NormalizedAnalysis) {
  console.info(`[analyze] ${label}: ${describeAnalysisShape(analysis)}`);
}

function isRecoverableAiSchemaError(status: number, errText: string): boolean {
  if (status !== 400) return false;
  const text = errText.toLowerCase();
  return text.includes("invalid_function_parameters") ||
    text.includes("invalid schema for function") ||
    text.includes("'required' is required") ||
    text.includes("including every key in properties");
}

function shouldFallbackForOpenAiClientError(status: number, errText: string): boolean {
  if ([400, 408, 409, 413, 422].includes(status)) return true;

  const text = errText.toLowerCase();
  return text.includes("context_length") ||
    text.includes("maximum context length") ||
    text.includes("prompt is too long") ||
    text.includes("too many tokens") ||
    text.includes("unprocessable entity");
}

// ─── Merge Layer A (deterministic) + Layer B (AI narrative) ─────────────────
//
// Layer A scores are AUTHORITATIVE — AI cannot override ats_score or section_scores.
// Layer B AI narrative fills: summaries, comments, recommendations, rewrite, questions.
//
// The AI tool schema (toolSchema) no longer contains score fields — it only
// accepts narrative fields. This function merges both outputs into NormalizedAnalysis.

export function mergeAnalysisLayers(
  deterministicScores: DeterministicScores,
  aiRaw: any,
  language: string
): NormalizedAnalysis {
  const fallbackText = language === "ar" ? "[يرجى التأكيد]" : "[Please confirm]";

  // Narratives come from AI (ats_breakdown_narratives field in new schema)
  // Fall back to ats_breakdown for backwards compatibility if needed
  const narratives = aiRaw?.ats_breakdown_narratives ?? aiRaw?.ats_breakdown ?? {};
  const recruiterComments = aiRaw?.recruiter_analysis_comments ?? aiRaw?.recruiter_analysis ?? {};

  const atsBreakdownItem = (
    engineDetail: { score: number; current_state: string; problem: string; recommended_improvement: string },
    aiNarrative: any
  ): AtsBreakdownItem => ({
    // Score: ALWAYS from deterministic engine — never from AI
    score: engineDetail.score,
    // Narrative: AI commentary, falling back to engine's own text. Capped at 600 chars each.
    current_state: asString(aiNarrative?.current_state, engineDetail.current_state).slice(0, 600),
    problem: asString(aiNarrative?.problem, engineDetail.problem).slice(0, 600),
    recommended_improvement: asString(aiNarrative?.recommended_improvement, engineDetail.recommended_improvement).slice(0, 600),
  });

  // candidate_level: engine is authoritative (years-based), but AI can provide
  // if engine returns 0 years (undetectable)
  const engineLevel = deterministicScores.candidate_level;
  const aiLevel = aiRaw?.executive_summary?.candidate_level;
  const resolvedLevel: "junior" | "mid" | "senior" | "executive" =
    deterministicScores.years_of_experience > 0
      ? engineLevel
      : (["junior", "mid", "senior", "executive"] as const).includes(aiLevel)
        ? aiLevel
        : engineLevel;

  return {
    // ── Identity (from AI — it reads the actual name and role) ─────────────
    target_role: asString(aiRaw?.target_role, fallbackText),
    candidate_name: asString(aiRaw?.candidate_name, fallbackText),

    // ── Scores: Layer A is authoritative ───────────────────────────────────
    ats_score: deterministicScores.ats_score,
    section_scores: deterministicScores.section_scores,

    // ── Executive summary: narrative from AI, level from engine ────────────
    executive_summary: {
      candidate_level: resolvedLevel,
      // Cap at 2500 chars — guards against AI echoing back raw CV text
      summary_paragraphs: asString(aiRaw?.executive_summary?.summary_paragraphs, fallbackText).slice(0, 2500),
      best_fit_roles: asStringArray(aiRaw?.executive_summary?.best_fit_roles).slice(0, 6),
      top_strengths: asStringArray(aiRaw?.executive_summary?.top_strengths).slice(0, 5),
      main_risks: asStringArray(aiRaw?.executive_summary?.main_risks).slice(0, 5),
    },

    // ── ATS breakdown: engine scores + AI narratives ────────────────────────
    ats_breakdown: {
      formatting: atsBreakdownItem(deterministicScores.ats_breakdown.formatting, narratives?.formatting),
      sections: atsBreakdownItem(deterministicScores.ats_breakdown.sections, narratives?.sections),
      keywords: atsBreakdownItem(deterministicScores.ats_breakdown.keywords, narratives?.keywords),
      experience: atsBreakdownItem(deterministicScores.ats_breakdown.experience, narratives?.experience),
      education: atsBreakdownItem(deterministicScores.ats_breakdown.education, narratives?.education),
      skills: atsBreakdownItem(deterministicScores.ats_breakdown.skills, narratives?.skills),
      contact_info: atsBreakdownItem(deterministicScores.ats_breakdown.contact_info, narratives?.contact_info),
    },

    // ── Recruiter analysis: engine-derived scores + AI comments ────────────
    recruiter_analysis: {
      first_impression: {
        // Scores derived from engine data, not from AI
        score: deterministicScores.section_scores.resume_formatting,
        comment: asString(recruiterComments?.first_impression?.comment ?? recruiterComments?.first_impression, fallbackText),
      },
      career_clarity: {
        score: deterministicScores.section_scores.career_progression,
        comment: asString(recruiterComments?.career_clarity?.comment ?? recruiterComments?.career_clarity, fallbackText),
      },
      achievement_strength: {
        score: deterministicScores.section_scores.experience_quality,
        comment: asString(recruiterComments?.achievement_strength?.comment ?? recruiterComments?.achievement_strength, fallbackText),
      },
      role_alignment: {
        score: deterministicScores.section_scores.keyword_optimization,
        comment: asString(recruiterComments?.role_alignment?.comment ?? recruiterComments?.role_alignment, fallbackText),
      },
      professional_presentation: {
        score: deterministicScores.section_scores.resume_formatting,
        comment: asString(recruiterComments?.professional_presentation?.comment ?? recruiterComments?.professional_presentation, fallbackText),
      },
    },

    // ── Career recommendations: pure AI ────────────────────────────────────
    career_recommendations: {
      top_roles: Array.isArray(aiRaw?.career_recommendations?.top_roles)
        ? aiRaw.career_recommendations.top_roles
            .map((item: any) => ({
              role: asString(item?.role),
              why_it_fits: asString(item?.why_it_fits),
            }))
            .filter((item: any) => item.role || item.why_it_fits)
        : [],
      skills_to_improve: asStringArray(aiRaw?.career_recommendations?.skills_to_improve),
      thirty_sixty_ninety_day_plan: {
        thirty_days: asString(aiRaw?.career_recommendations?.thirty_sixty_ninety_day_plan?.thirty_days, fallbackText),
        sixty_days: asString(aiRaw?.career_recommendations?.thirty_sixty_ninety_day_plan?.sixty_days, fallbackText),
        ninety_days: asString(aiRaw?.career_recommendations?.thirty_sixty_ninety_day_plan?.ninety_days, fallbackText),
      },
      certifications_recommended: asStringArray(aiRaw?.career_recommendations?.certifications_recommended),
      linkedin_improvements: asString(aiRaw?.career_recommendations?.linkedin_improvements, ""),
    },

    // ── Salary: pure AI (market-calibrated reasoning) ──────────────────────
    salary_estimation: {
      salary_table: Array.isArray(aiRaw?.salary_estimation?.salary_table)
        ? aiRaw.salary_estimation.salary_table
            .map((item: any) => ({
              role: asString(item?.role),
              monthly_range_low: Number(item?.monthly_range_low) || 0,
              monthly_range_high: Number(item?.monthly_range_high) || 0,
              when_upper_range: asString(item?.when_upper_range),
              notes: asString(item?.notes),
            }))
            .filter((item: any) => item.role)
        : [],
      offer_range_low: Number(aiRaw?.salary_estimation?.offer_range_low) || 0,
      offer_range_high: Number(aiRaw?.salary_estimation?.offer_range_high) || 0,
      negotiation_target: Number(aiRaw?.salary_estimation?.negotiation_target) || 0,
      anchor: Number(aiRaw?.salary_estimation?.anchor) || 0,
      walk_away: Number(aiRaw?.salary_estimation?.walk_away) || 0,
    },

    // ── Resume rewrite: pure AI ─────────────────────────────────────────────
    resume_rewrite: {
      full_resume: asString(aiRaw?.resume_rewrite?.full_resume, fallbackText),
    },

    // ── Quick improvements: pure AI, priority validated ─────────────────────
    quick_improvements: Array.isArray(aiRaw?.quick_improvements)
      ? aiRaw.quick_improvements
          .map((item: any) => ({
            priority: (["high", "medium", "low"] as const).includes(item?.priority)
              ? item.priority
              : ("medium" as const),
            description: asString(item?.description).slice(0, 400),
            action_step: asString(item?.action_step).slice(0, 400),
          }))
          .filter((item: any) => item.description || item.action_step)
      : [],

    // ── Interview questions: pure AI ────────────────────────────────────────
    interview_questions: Array.isArray(aiRaw?.interview_questions)
      ? aiRaw.interview_questions
          .map((item: any) => ({
            question: asString(item?.question).slice(0, 400),
            suggested_answer_direction: asString(item?.suggested_answer_direction).slice(0, 800),
          }))
          .filter((item: any) => item.question || item.suggested_answer_direction)
      : [],
  };
}

/** @deprecated Use mergeAnalysisLayers() — kept for any legacy call sites */
export function normalizeAnalysis(raw: any, language: string): NormalizedAnalysis {
  // This path is only reached if callAnalysisAI() is bypassed (should not happen).
  // Build a stub DeterministicScores from whatever the AI returned.
  const stub: DeterministicScores = {
    ats_score: clampScore(raw?.ats_score, 0),
    section_scores: {
      resume_formatting: clampScore(raw?.section_scores?.resume_formatting, 0),
      keyword_optimization: clampScore(raw?.section_scores?.keyword_optimization, 0),
      experience_quality: clampScore(raw?.section_scores?.experience_quality, 0),
      career_progression: clampScore(raw?.section_scores?.career_progression, 0),
      skills_relevance: clampScore(raw?.section_scores?.skills_relevance, 0),
      education_strength: clampScore(raw?.section_scores?.education_strength, 0),
      contact_information_quality: clampScore(raw?.section_scores?.contact_information_quality, 0),
    },
    ats_breakdown: {
      formatting: { score: clampScore(raw?.ats_breakdown?.formatting?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      sections: { score: clampScore(raw?.ats_breakdown?.sections?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      keywords: { score: clampScore(raw?.ats_breakdown?.keywords?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      experience: { score: clampScore(raw?.ats_breakdown?.experience?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      education: { score: clampScore(raw?.ats_breakdown?.education?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      skills: { score: clampScore(raw?.ats_breakdown?.skills?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
      contact_info: { score: clampScore(raw?.ats_breakdown?.contact_info?.score, 0), current_state: "", problem: "", recommended_improvement: "" },
    },
    candidate_level: "mid",
    years_of_experience: 0,
    missing_sections: [],
    keywords_found: [],
    keywords_missing_hints: [],
  };
  return mergeAnalysisLayers(stub, raw, language);
}

// ─── Master Prompt (single source of truth) ───────────────────────────────────
//
// THIS IS THE ONLY PLACE where the analysis prompt is defined.
// Both Job Seeker (analyze-resume) and Recruiter (recruiter-analyze-candidate)
// flows call buildPrompt() and receive identical instructions.
//
// EDITING RULES:
//   - Never copy this prompt into any other file.
//   - Never call OpenAI with a manually constructed prompt outside callAnalysisAI().
//   - To change analysis behaviour for ALL flows, edit ONLY this function.

export function buildPrompt(
  resumeText: string,
  language: string,
  engineScores?: DeterministicScores
): { systemPrompt: string; userPrompt: string } {
  const langInstruction =
    language === "ar"
      ? "أجب باللغة العربية الفصحى الواضحة لجميع الأقسام. استثناء وحيد: حقل resume_rewrite.full_resume يجب أن يكون بالإنجليزية المهنية حصراً — لا تُترجمه أبداً."
      : "Respond in English for ALL fields. The single exception: resume_rewrite.full_resume must always be professional English regardless of input language.";

  const today = new Date().toISOString().split("T")[0];

  // ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
  const systemPrompt = `\
You are TALENTRY's official ATS Analysis Engine — a Senior Recruitment Director and Certified ATS Specialist \
with 20+ years of experience placing candidates across Saudi Arabia, the Gulf (GCC), and global markets.

Your expertise covers:
  • Saudi Vision 2030 priority sectors: NEOM, tourism, fintech, healthcare, logistics, renewable energy
  • GCC employment law: GOSI, Iqama, Nitaqat quotas, Saudization/Emiratization targets
  • Enterprise ATS platforms used by top GCC employers: SAP SuccessFactors, Oracle HCM, Taleo, Workday, iCIMS
  • Salary benchmarking in SAR across Saudi regions and industries
  • What actually causes ATS rejection vs. human shortlisting in the GCC market

LANGUAGE: ${langInstruction}

TODAY IS: ${today} — use this as the exact end-date for all experience duration calculations.

════════════════════════════════════════════════════════
OUTPUT CONTRACT — READ BEFORE GENERATING ANYTHING
════════════════════════════════════════════════════════

OUTPUT FORMAT
  • You MUST respond exclusively via the submit_analysis tool call.
  • Do NOT output any prose, markdown, commentary, or explanation outside the tool call.
  • Every field in the schema is REQUIRED. Missing fields will cause a system failure.
  • Do NOT include any numeric score fields anywhere in the tool output.
  • Do NOT include null, markdown, code fences, or explanatory text outside the tool call.

EVIDENCE REQUIREMENT (most critical rule)
  • Every strength, risk, score, and recommendation MUST cite specific evidence from the resume.
  • BAD: "Strong communication skills."
  • GOOD: "Delivered 3 cross-functional product launches at SABIC (2021–2023) — evidence of stakeholder management."
  • If the evidence does not exist in the resume text, do NOT invent it. Write "[Please confirm]" (EN) or "[يرجى التأكيد]" (AR).

ANTI-GENERIC RULES — VIOLATIONS WILL FAIL QUALITY REVIEW
  • BANNED phrases (never use): "strong communication skills", "team player", "fast learner",
    "detail-oriented", "results-driven", "passionate about", "seeking opportunities to grow",
    "improve your resume", "add more details", "tailor to the job".
  • Every improvement must name the EXACT field, section, or bullet to change.
  • Every skill gap must name the EXACT technology, certification, or competency that is missing.
  • Every salary figure must be a specific SAR integer — no ranges stated as "varies".

SCORING CALIBRATION
  • 90–100: Publication-ready, would pass every major ATS in GCC with zero edits.
  • 75–89: Competitive. Minor gaps only. Would reach human review in most companies.
  • 50–74: Average. Significant gaps. Would fail selective ATS filters.
  • 25–49: Below standard. Multiple structural or keyword problems.
  • 0–24: Effectively invisible to ATS. Requires complete rebuild.
  • The overall ats_score must be consistent with the average of section_scores (within ±8 points).

KEYWORD GAP ANALYSIS (mandatory — drives keyword_optimization score)
  Identify ATS keywords that are ABSENT from the resume but are standard requirements for the target role
  in GCC job postings. Name them explicitly in:
    • ats_breakdown.keywords.problem  ← list the missing keywords by name
    • ats_breakdown.keywords.recommended_improvement  ← instruct exactly where/how to add them
    • quick_improvements  ← at least 3 of the 12 items must address specific missing keywords

SALARY RULES
  • All figures are SAR monthly (not annual, not USD).
  • Calibrate to Saudi market specifically — not global benchmarks.
  • walk_away must always be lower than offer_range_low.
  • anchor must always be higher than negotiation_target.
  • negotiation_target must be between offer_range_low and offer_range_high.

RESUME REWRITE RULES
  • Must be complete — not a template with placeholder sections.
  • Use STAR format for every work experience bullet (Situation/Task → Action → Result with numbers).
  • Replace ALL duty-listing language with achievement language.
  • Include only information that exists in the original resume. Use "[Please confirm]" for any gap.
  • Must be parseable by Taleo, Workday, and SAP SuccessFactors without encoding errors.`;

  // ── USER PROMPT ──────────────────────────────────────────────────────────────
  const userPrompt = `\
Run TALENTRY's official ATS Career Intelligence Analysis on the resume below.
Target market: Saudi Arabia / GCC.
If no target role is stated in the resume, infer the single most competitive role this candidate can win \
in the current Saudi/GCC market based on their strongest demonstrated skills and most recent title.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RESUME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${resumeText.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${engineScores ? `━━━━━━━━━━━━━━━━━━━ ATS ENGINE PRE-COMPUTED SCORES ━━━━━━━━━━━━━━━━━━━
The deterministic ATS engine has already computed the following scores.
These scores are FINAL — your tool call MUST NOT include any score fields.
Your job is ONLY to provide narrative commentary that explains and enriches these scores.

  ATS Score (overall, authoritative): ${engineScores.ats_score}/100
  resume_formatting:          ${engineScores.section_scores.resume_formatting}/100
  keyword_optimization:       ${engineScores.section_scores.keyword_optimization}/100
  experience_quality:         ${engineScores.section_scores.experience_quality}/100
  career_progression:         ${engineScores.section_scores.career_progression}/100
  skills_relevance:           ${engineScores.section_scores.skills_relevance}/100
  education_strength:         ${engineScores.section_scores.education_strength}/100
  contact_information_quality:${engineScores.section_scores.contact_information_quality}/100

  Candidate level (engine):   ${engineScores.candidate_level} (~${engineScores.years_of_experience} years detected)
  Missing sections:           ${engineScores.missing_sections.length > 0 ? engineScores.missing_sections.join(", ") : "none"}
  Keywords found (${engineScores.keywords_found.length}):        ${engineScores.keywords_found.slice(0, 10).join(", ")}
  Keyword gaps (top hints):   ${engineScores.keywords_missing_hints.slice(0, 8).join(", ")}

  Engine breakdown narratives (use as starting context, you may improve):
${Object.entries(engineScores.ats_breakdown).map(([k, v]: [string, any]) =>
  `  [${k}] current: ${v.current_state} | problem: ${v.problem || "none"}`
).join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ""}

FIELD-BY-FIELD INSTRUCTIONS:

① target_role
   Single job title. Most competitive role for this candidate in GCC right now.
   Vision 2030 alignment is a positive signal — reflect it if present.

② candidate_name
   Extract from resume header. If absent, write "[Please confirm]".

③ executive_summary
   candidate_level          — Exactly one of: "junior" | "mid" | "senior" | "executive"
                              Base on total years of experience: <3y=junior, 3–7y=mid, 7–15y=senior, 15y+=executive.
   summary_paragraphs       — 3 paragraphs:
                              P1: Overall impression — what kind of professional is this and at what level?
                              P2: Key value proposition — what is this candidate's strongest competitive edge in GCC?
                              P3: Critical gaps — what will make GCC recruiters hesitate or reject? Be blunt.
                              Each paragraph minimum 3 sentences. No generic openers.
   best_fit_roles           — 3–5 specific role titles. Format: seniority + function + domain.
                              Example: "Senior Supply Chain Analyst – FMCG/Retail". Not just "Supply Chain".
   top_strengths            — Exactly 3 items. Each must:
                              (a) name a specific skill or quality, (b) cite evidence from the resume,
                              (c) explain why it matters for GCC hiring specifically.
                              Format: "[Strength]: [Evidence from resume] → [GCC hiring relevance]"
   main_risks               — Exactly 3 items. Each must:
                              (a) name the specific risk, (b) cite what is missing or problematic in the resume,
                              (c) state the likely recruiter reaction.
                              Format: "[Risk]: [Evidence of problem] → [Recruiter impact]"

⑥ ats_breakdown_narratives (7 categories — formatting, sections, keywords, experience, education, skills, contact_info)
   Each category requires ONLY these 3 fields:
   current_state            — One sentence describing what is actually present in the resume right now.
   problem                  — One sentence stating the specific ATS or recruiter problem this causes.
                              For keywords: LIST the top 5 missing keywords by name.
   recommended_improvement  — One imperative sentence with the exact fix.
                              For keywords: name the exact keywords and the exact section to add them to.
   Do NOT include a score field.

⑦ recruiter_analysis_comments (5 dimensions)
   Each dimension requires ONLY a comment string.
   Comment rules: minimum 2 sentences, must reference specific resume content, no generic observations.
   first_impression         — What does a GCC recruiter think within the first 6 seconds of seeing this?
   career_clarity           — Is the professional direction immediately obvious? Does the resume tell one story?
   achievement_strength     — Are achievements quantified and impactful, or is it a list of duties?
   role_alignment           — Does this resume feel purpose-built for the target role, or generic?
   professional_presentation — Grammar, tone, formatting consistency, absence of typos/errors.

⑧ career_recommendations
   top_roles                — 3–5 objects. Each: role (specific title) + why_it_fits (2 sentences citing resume evidence).
   skills_to_improve        — 5–8 items. Each is a SPECIFIC technology, tool, certification, or methodology.
                              Format: "Skill name — reason it matters for [target_role] in GCC"
                              BANNED: "communication", "leadership", "teamwork", "time management".
   thirty_sixty_ninety_day_plan:
     thirty_days            — 3 concrete actions for weeks 1–4 (e.g., "Complete AWS SAA practice exams on A Cloud Guru").
     sixty_days             — 3 concrete actions for weeks 5–8 (e.g., "Apply to 20 [target_role] postings on Bayt and LinkedIn with tailored cover letters").
     ninety_days            — 3 concrete actions for weeks 9–12 (e.g., "Attend HRDF-certified workshop on [specific skill gap]").
   certifications_recommended — 3–5 specific certification names relevant to target_role in GCC.
                              Include issuing body. Example: "PMP — Project Management Institute", "CMA — IMA".
   linkedin_improvements    — 3–5 specific changes. Each names the exact LinkedIn section and the exact change.
                              Example: "About section: rewrite opening line to lead with [specific value proposition]".

⑨ salary_estimation (all SAR monthly integers)
   salary_table             — Target role + 2 adjacent roles. For each row:
                              role, monthly_range_low, monthly_range_high,
                              when_upper_range (what would unlock the top of range),
                              notes (city/sector/company-size factors specific to Saudi market).
   offer_range_low/high     — Realistic range for THIS specific candidate given their actual profile.
   negotiation_target       — Realistic ask that would succeed without rejection.
   anchor                   — Opening number (must be higher than negotiation_target).
   walk_away                — Absolute minimum (must be lower than offer_range_low).

⑩ resume_rewrite.full_resume
   Complete ATS-optimized resume in English. Mandatory sections in this order:
   1. Header: Full Name | Phone (+country code) | Professional Email | LinkedIn | City, Country
   2. Professional Summary: 3–4 lines. Lead with years of experience + domain + top achievement.
   3. Core Competencies: 12–18 keywords in a 3-column grid. Include exact role-critical ATS terms.
   4. Professional Experience: Each role → Company | Title | City | Dates. Then 4–6 STAR bullets with numbers.
   5. Education: Degree | Institution | Year. GPA only if ≥3.5/4.0.
   6. Certifications (if any): Name | Issuing Body | Year.
   7. Languages: Language — Proficiency level.
   Use "[Please confirm]" for any information not in the original resume. No invention.

⑪ quick_improvements (exactly 12 items, sorted high → medium → low priority)
   Each item MUST include:
   priority                 — "high" | "medium" | "low"
   description              — One sentence identifying the exact problem. Must name the specific section or field.
   action_step              — One imperative sentence with the exact fix.
                              BAD: "Improve your summary." GOOD: "Replace the current summary opening 'I am a motivated professional' with '[X years] of [domain] experience delivering [specific outcome]'."
   Distribution requirement: at least 5 high, at least 4 medium, at least 3 low.
   At least 3 items must address specific missing ATS keywords by name.
   At least 2 items must address quantification of specific existing bullet points.

⑫ interview_questions (exactly 10 questions)
   Mix: 4 behavioral (STAR-format answers expected) + 3 technical + 2 situational + 1 culture/market fit (GCC-specific).
   Each question: question (string) + suggested_answer_direction (4–6 sentences of specific guidance).
   suggested_answer_direction must reference the candidate's actual resume content where relevant.
   GCC culture/market fit question must address one of: Saudi Vision 2030, Saudization, working in a multicultural GCC team, or regional business norms.`;

  return { systemPrompt, userPrompt };
}

// ─── Core AI call ─────────────────────────────────────────────────────────────
//
// Pipeline order (guaranteed for BOTH Job Seeker and Recruiter flows):
//   1. normalizeResumeText()   — deterministic, no AI, cleans + structures raw text
//   2. prepareTextForPrompt()  — assembles labelled sections for AI injection
//   3. buildPrompt()           — injects prepared text into the master prompt
//   4. OpenAI gpt-4o call      — structured analysis via tool call
//   5. normalizeAnalysis()     — clamps/validates all AI output fields

export interface CallAnalysisOptions {
  resumeText: string;
  language: string;
  geminiApiKey: string;
  timeoutMs?: number;
}

export interface CallAnalysisResult {
  analysis: NormalizedAnalysis;
  /** Structured resume fields extracted deterministically before AI call. */
  normalizedInput: import("./resume-normalizer.ts").NormalizedResumeInput;
  /** Layer A scores — stable, code-driven, never overridden by AI. */
  deterministicScores: DeterministicScores;
}

function buildDeterministicFallback(
  deterministicScores: DeterministicScores,
  normalizedInput: import("./resume-normalizer.ts").NormalizedResumeInput,
  language: string,
): NormalizedAnalysis {
  const placeholder = language === "ar" ? "تعذر استكمال السرد الذكي، لكن تم إظهار التقييم الحتمي." : "AI narrative could not be completed, but deterministic scoring is available.";
  const candidateName = normalizedInput.name?.trim() || (language === "ar" ? "[يرجى التأكيد]" : "[Please confirm]");
  const inferredRoles = [normalizedInput.job_title, ...(normalizedInput.experience || []).slice(0, 2)]
    .filter(Boolean)
    .map((role) => String(role).trim())
    .filter((role, index, arr) => arr.indexOf(role) === index)
    .slice(0, 3);
  const topRoles = inferredRoles.map((role: string) => ({
    role,
    why_it_fits: placeholder,
  }));

  return mergeAnalysisLayers(
    deterministicScores,
    {
      target_role: normalizedInput.job_title || topRoles[0]?.role || (language === "ar" ? "[يرجى التأكيد]" : "[Please confirm]"),
      candidate_name: candidateName,
      executive_summary: {
        candidate_level: deterministicScores.candidate_level,
        summary_paragraphs: placeholder,
        best_fit_roles: topRoles.map((r) => r.role),
        top_strengths: [placeholder, placeholder, placeholder],
        main_risks: [placeholder, placeholder, placeholder],
      },
      ats_breakdown_narratives: {
        formatting: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        sections: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        keywords: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        experience: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        education: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        skills: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
        contact_info: { current_state: placeholder, problem: placeholder, recommended_improvement: placeholder },
      },
      recruiter_analysis_comments: {
        first_impression: placeholder,
        career_clarity: placeholder,
        achievement_strength: placeholder,
        role_alignment: placeholder,
        professional_presentation: placeholder,
      },
      career_recommendations: {
        top_roles: topRoles,
        skills_to_improve: normalizedInput.skills?.slice(0, 5) || [],
        thirty_sixty_ninety_day_plan: {
          thirty_days: placeholder,
          sixty_days: placeholder,
          ninety_days: placeholder,
        },
        certifications_recommended: normalizedInput.certifications?.slice(0, 5) || [],
        linkedin_improvements: placeholder,
      },
      salary_estimation: {
        salary_table: [],
        offer_range_low: 0,
        offer_range_high: 0,
        negotiation_target: 0,
        anchor: 0,
        walk_away: 0,
      },
      resume_rewrite: { full_resume: placeholder },
      quick_improvements: [
        { priority: "high", description: placeholder, action_step: placeholder },
        { priority: "high", description: placeholder, action_step: placeholder },
        { priority: "medium", description: placeholder, action_step: placeholder },
        { priority: "medium", description: placeholder, action_step: placeholder },
        { priority: "low", description: placeholder, action_step: placeholder },
      ],
      interview_questions: [
        { question: placeholder, suggested_answer_direction: placeholder },
        { question: placeholder, suggested_answer_direction: placeholder },
        { question: placeholder, suggested_answer_direction: placeholder },
        { question: placeholder, suggested_answer_direction: placeholder },
        { question: placeholder, suggested_answer_direction: placeholder },
      ],
    },
    language,
  );
}

export async function callAnalysisAI(opts: CallAnalysisOptions): Promise<CallAnalysisResult> {
  const { resumeText, language, geminiApiKey, timeoutMs = 170_000 } = opts;

  // ── Layer A: Deterministic normalization + ATS scoring (no AI) ─────────────
  const rawText = resumeText ?? "";
  let normalizedInput = normalizeResumeText(rawText);
  console.log(`[analysis-core] rawText length: ${rawText.length} chars`);
  console.log(`[analysis-core] normalizedInput: skills=${normalizedInput.skills.length}, experience=${normalizedInput.workExperience?.length ?? 0}`);

  if (rawText.length > 200 && normalizedInput.skills.length < 3) {
    console.warn("[analysis-core] Weak skills extraction detected. Re-running normalizer fallback guard.");
    normalizedInput = normalizeResumeText(`${rawText}\n${rawText}`);
    console.log(`[analysis-core] normalizedInput after guard: skills=${normalizedInput.skills.length}`);
  }

  const deterministicScores = computeAtsScores(normalizedInput, rawText);

  // ── Prepare cleaned text for AI prompt injection ────────────────────────────
  const preparedText = prepareTextForPrompt(normalizedInput);

  // ── Layer B: Build base prompt ─────────────────────────────────────────────
  const { systemPrompt, userPrompt } = buildPrompt(preparedText, language, deterministicScores);

  // ── Retry loop — max VALIDATION.MAX_ATTEMPTS total (including first call) ──
  // Attempt 1: base prompt.
  // Attempt 2+: base prompt + correction prefix listing exactly which rules failed.
  // Loop exits on: pass, repair, fail, or non-retryable HTTP error.

  let lastFailureSummary = "";
  let retryPrefix = "";

  for (let attempt = 1; attempt <= VALIDATION.MAX_ATTEMPTS; attempt++) {
    const isRetry = attempt > 1;

    if (isRetry) {
      console.warn(`[analyze] Retry ${attempt}/${VALIDATION.MAX_ATTEMPTS}: ${lastFailureSummary}`);
    }

    // ── HTTP call ──────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: isRetry ? `${retryPrefix}

---

${userPrompt}` : userPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: toolSchema.function.parameters,
            temperature: isRetry ? 0.35 : 0.2,
            maxOutputTokens: 8000,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // ── HTTP error handling ────────────────────────────────────────────────
    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        // Retry with exponential backoff instead of failing immediately
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
        console.warn(`[analyze] Gemini rate limit (attempt ${attempt}), retrying in ${backoffMs}ms`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      if (response.status === 402) throw Object.assign(new Error("credits_exhausted"), { status: 402 });
      if (response.status === 500 || response.status === 503) {
        // OpenAI transient server errors — retry with backoff
        const backoffMs = Math.min(3000 * attempt, 15000);
        console.warn(`[analyze] Gemini server error ${response.status} (attempt ${attempt}), retrying in ${backoffMs}ms. Body: ${errText.slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      console.error(`[analyze] AI gateway error (attempt ${attempt}):`, response.status, errText.slice(0, 500));
      if (isRecoverableAiSchemaError(response.status, errText)) {
        console.warn(`[analyze] Gemini rejected the response schema/request. Falling back to deterministic analysis. Raw error: ${truncateForLog(errText, 1000)}`);
        const analysis = buildDeterministicFallback(deterministicScores, normalizedInput, language);
        logFinalAnalysis("Final normalized response shape (schema fallback)", analysis);
        return { analysis, normalizedInput, deterministicScores };
      }
      if (shouldFallbackForOpenAiClientError(response.status, errText)) {
        console.warn(`[analyze] Gemini returned a recoverable client error. Falling back to deterministic analysis. Status=${response.status}; Raw error: ${truncateForLog(errText, 1000)}`);
        const analysis = buildDeterministicFallback(deterministicScores, normalizedInput, language);
        logFinalAnalysis("Final normalized response shape (client-error fallback)", analysis);
        return { analysis, normalizedInput, deterministicScores };
      }
      // Other gateway errors (400, 401, etc.) are not retried
      throw Object.assign(new Error("ai_gateway_error"), { status: 502 });
    }

    // ── Parse response ─────────────────────────────────────────────────────
    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      console.error(`[analyze] Failed to decode Gemini JSON response (attempt ${attempt}):`, error);
      const analysis = buildDeterministicFallback(deterministicScores, normalizedInput, language);
      logFinalAnalysis("Final normalized response shape (response-json fallback)", analysis);
      return { analysis, normalizedInput, deterministicScores };
    }
    let parsedRaw: any = null;
    const rawToolArguments = "";
    const rawContentText = getGeminiCandidateText(data);

    if (rawToolArguments) {
      console.info(`[analyze] Raw AI tool arguments (attempt ${attempt}): ${truncateForLog(rawToolArguments)}`);
      parsedRaw = tryParseJsonCandidate(rawToolArguments);
      if (!parsedRaw) {
        console.error(`[analyze] JSON parse error (attempt ${attempt}): unable to parse tool arguments`);
        // parsedRaw stays null — validator will treat this as malformed
      }
    }

    if (rawContentText) {
      console.info(`[analyze] Raw AI message content (attempt ${attempt}): ${truncateForLog(rawContentText)}`);
    }

    if (!parsedRaw && rawContentText) {
      parsedRaw = tryExtractJsonFromText(rawContentText);
      if (parsedRaw) {
        console.warn(`[analyze] Recovered AI payload from message content on attempt ${attempt}`);
      }
    }

    // ── Validate ───────────────────────────────────────────────────────────
    const decision = validateAiOutput(parsedRaw, attempt);
    if (decision.failures.length) {
      console.warn(`[analyze] Validation failures (attempt ${attempt}): ${JSON.stringify(decision.failures)}`);
    }
    console.info(`[analyze] Attempt ${attempt} → ${decision.summary}`);

    if (decision.action === "pass") {
      // ✅ Output meets all quality rules — merge and return
      const analysis = mergeAnalysisLayers(deterministicScores, parsedRaw, language);
      logFinalAnalysis("Final normalized response shape", analysis);
      return { analysis, normalizedInput, deterministicScores };
    }

    if (decision.action === "repair") {
      // 🔧 Minor out-of-range values fixed in place — merge repaired object
      console.warn(`[analyze] Repaired output on attempt ${attempt}`);
      const analysis = mergeAnalysisLayers(deterministicScores, decision.repaired!, language);
      logFinalAnalysis("Final normalized response shape (repaired)", analysis);
      return { analysis, normalizedInput, deterministicScores };
    }

    if (decision.action === "fail") {
      // ❌ Max attempts exhausted with persistent failures
      console.error(`[analyze] Output failed validation after ${attempt} attempts.`, decision.failures);
      // Last-resort: if we have ANY parsedRaw, use it (better than nothing)
      // but log that it is sub-quality.
      if (parsedRaw) {
        console.warn(`[analyze] Using sub-quality output as last resort.`);
        const analysis = mergeAnalysisLayers(deterministicScores, parsedRaw, language);
        logFinalAnalysis("Final normalized response shape (sub-quality)", analysis);
        return { analysis, normalizedInput, deterministicScores };
      }
      console.warn(`[analyze] Falling back to deterministic-only analysis after validation failure.`);
      const analysis = buildDeterministicFallback(deterministicScores, normalizedInput, language);
      logFinalAnalysis("Final normalized response shape (deterministic fallback)", analysis);
      return { analysis, normalizedInput, deterministicScores };
    }

    // decision.action === "retry" — prepare correction prefix for next loop
    lastFailureSummary = decision.summary;
    retryPrefix = buildRetryPrefix(decision.failures, attempt);
    // Continue to next iteration
  }

  // Should never reach here (loop covers 1..MAX_ATTEMPTS and always returns/throws)
  console.warn(`[analyze] Retries exhausted. Returning deterministic fallback.`);
  const analysis = buildDeterministicFallback(deterministicScores, normalizedInput, language);
  logFinalAnalysis("Final normalized response shape (retry exhaustion fallback)", analysis);
  return { analysis, normalizedInput, deterministicScores };
}
