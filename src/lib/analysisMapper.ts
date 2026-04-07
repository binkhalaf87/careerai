/**
 * TALENTRY — Unified Analysis Response Mapper
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for normalising raw analysis JSON → UI-ready shape.
 *
 * HANDLES BOTH SCHEMAS:
 *   A) Job Seeker (NormalizedAnalysis from analyze-resume edge function)
 *      Fields: executive_summary.top_strengths, executive_summary.main_risks,
 *              ats_score, section_scores, ats_breakdown, quick_improvements, ...
 *
 *   B) Recruiter (recruiter-analyze-candidate, legacy, or mixed)
 *      Fields: executive_hiring_summary, scoring_table, strengths, risks,
 *              hiring_recommendation, missing_requirements, ...
 *
 * OUTPUT: MappedAnalysis — one shape consumed by every rendering component.
 *
 * RULES:
 *   - Every field has a typed fallback — no component receives undefined
 *   - Field access always checks both schema variants before falling back
 *   - No rendering logic here — pure data transformation only
 *   - All scores are integers clamped to [0, 100]
 *
 * USAGE:
 *   import { mapAnalysisResponse } from "@/lib/analysisMapper";
 *   const mapped = mapAnalysisResponse(rawAnalysisJson);
 */

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT TYPE  — the canonical shape every screen renders
// ═══════════════════════════════════════════════════════════════════════════════

export interface MappedSectionScore {
  key: string;
  label: string;
  value: number;
}

export interface MappedImprovement {
  priority: "high" | "medium" | "low";
  description: string;
  action_step: string;
}

export interface MappedBreakdownItem {
  score: number;
  current_state: string;
  problem: string;
  recommended_improvement: string;
}

export interface MappedAnalysis {
  // ── Core score ──────────────────────────────────────────────────────────────
  overall_score: number;

  // ── Section scores: flat record for Progress bars ───────────────────────────
  section_scores: Record<string, number>;

  // ── Section scores: labelled list for rendering ─────────────────────────────
  section_score_items: MappedSectionScore[];

  // ── Narrative fields ────────────────────────────────────────────────────────
  candidate_level: "junior" | "mid" | "senior" | "executive" | null;
  target_role: string;
  candidate_name: string;
  summary: string;           // executive paragraph(s)

  // ── Strengths / weaknesses / risks ─────────────────────────────────────────
  strengths: string[];       // top_strengths / strengths (whichever is present)
  weaknesses: string[];      // main_risks / risks / concerns / red_flags
  missing_keywords: string[];// from ats_breakdown.keywords.problem or missing_requirements
  issues: string[];          // formatted issue list for RewriteIssuesCard
  improvements: MappedImprovement[]; // quick_improvements

  // ── Recruiter-specific convenience fields ───────────────────────────────────
  best_fit_roles: string[];
  interview_focus_areas: string[];
  missing_requirements: string[];
  hiring_decision: string;
  hiring_reasoning: string;
  why_this_candidate: string;
  why_not_this_candidate: string;

  // ── ATS breakdown: per-dimension detail ────────────────────────────────────
  ats_breakdown: Record<string, MappedBreakdownItem>;

  // ── Salary estimation ───────────────────────────────────────────────────────
  salary: {
    offer_range_low: number;
    offer_range_high: number;
    negotiation_target: number;
    walk_away: number;
    anchor: number;
  } | null;

  // ── Recommendations ─────────────────────────────────────────────────────────
  certifications_recommended: string[];
  skills_to_improve: string[];
  linkedin_improvements: string;

  // ── 30/60/90 day plan ───────────────────────────────────────────────────────
  plan_30_days: string;
  plan_60_days: string;
  plan_90_days: string;

  // ── Resume rewrite ──────────────────────────────────────────────────────────
  rewrite_full_resume: string;

  // ── Interview questions ─────────────────────────────────────────────────────
  interview_questions: { question: string; suggested_answer_direction: string }[];

  // ── Raw pass-through for components that still need it ──────────────────────
  _raw: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS  (not exported — internal to this module only)
// ═══════════════════════════════════════════════════════════════════════════════

function clampScore(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function asStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStrArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          // Handle {description: string} or {question: string} objects — extract first string field
          const obj = item as Record<string, unknown>;
          const first = Object.values(obj).find((v) => typeof v === "string");
          return typeof first === "string" ? first.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|•|·|- /)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function firstStr(...values: unknown[]): string {
  for (const v of values) {
    const s = asStr(v);
    if (s) return s;
  }
  return "";
}

/** Extract named keywords from a problem/text string */
function extractKeywordsFromProblemText(text: string): string[] {
  if (!text) return [];
  // Split on commas, semicolons, bullets, "and", pipes
  return text
    .split(/[,;•·|]|\band\b/)
    .map((t) => t.replace(/missing[:\s]*/i, "").replace(/\(.*?\)/g, "").trim())
    .filter((t) => t.length >= 2 && t.length <= 40 && !/^(the|a|an|for|of|or|not|any|all|with|from|that|this)$/i.test(t));
}

/** Derive missing_keywords from wherever they live in either schema */
function deriveMissingKeywords(raw: Record<string, unknown>): string[] {
  // Schema A: ats_breakdown.keywords.problem contains named keywords
  const breakdown = raw.ats_breakdown as Record<string, unknown> | undefined;
  const kwProblem = asStr((breakdown?.keywords as any)?.problem);
  if (kwProblem) {
    const extracted = extractKeywordsFromProblemText(kwProblem);
    if (extracted.length >= 1) return extracted;
  }

  // Schema B: keywords_missing_hints array (from engine output in prompt context)
  const hints = asStrArray(raw.keywords_missing_hints);
  if (hints.length) return hints;

  // Schema B alt: missing_requirements
  const missing = asStrArray(raw.missing_requirements ?? (raw as any).missing_info);
  if (missing.length) return missing;

  return [];
}

/** Map section_scores from either schema into a consistent record */
function deriveSectionScores(raw: Record<string, unknown>): Record<string, number> {
  // Schema A: section_scores is a flat {key: number} object
  const ss = raw.section_scores;
  if (ss && typeof ss === "object" && !Array.isArray(ss)) {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(ss as Record<string, unknown>)) {
      result[k] = clampScore(v);
    }
    if (Object.keys(result).length > 0) return result;
  }

  // Schema B: scoring_table {ats_compatibility, role_match, experience_depth, skill_relevance, career_progression}
  const st = raw.scoring_table as Record<string, unknown> | undefined;
  if (st && typeof st === "object") {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(st)) {
      const n = clampScore(v);
      if (n > 0) result[k] = n;
    }
    if (Object.keys(result).length > 0) return result;
  }

  return {};
}

const SECTION_SCORE_LABELS: Record<string, string> = {
  // Schema A labels
  resume_formatting: "Formatting",
  keyword_optimization: "Keywords",
  experience_quality: "Experience Quality",
  career_progression: "Career Progression",
  skills_relevance: "Skills Relevance",
  education_strength: "Education",
  contact_information_quality: "Contact Info",
  // Schema B labels
  ats_compatibility: "ATS Compatibility",
  role_match: "Role Match",
  experience_depth: "Experience Depth",
  skill_relevance: "Skill Relevance",
  // Factor engine labels
  section_completeness: "Section Completeness",
  skills_presence: "Skills Presence",
  experience_clarity: "Experience Clarity",
  measurable_achievements: "Achievements",
  keyword_coverage: "Keyword Coverage",
  formatting: "Formatting",
  summary_quality: "Summary Quality",
};

function deriveSectionScoreItems(sectionScores: Record<string, number>): MappedSectionScore[] {
  return Object.entries(sectionScores)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      key: k,
      label: SECTION_SCORE_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: v,
    }))
    .sort((a, b) => b.value - a.value);
}

function deriveOverallScore(raw: Record<string, unknown>): number {
  // Prefer engine's authoritative score
  if (raw.ats_score != null) return clampScore(raw.ats_score);
  if (raw.overall_score != null) return clampScore(raw.overall_score);
  if (raw.score != null) return clampScore(raw.score);

  // Fall back to executive_hiring_summary / scoring_table
  const exec = raw.executive_hiring_summary as Record<string, unknown> | undefined;
  if (exec?.overall_fit_score != null) return clampScore(exec.overall_fit_score);

  const st = raw.scoring_table as Record<string, unknown> | undefined;
  if (st?.role_match != null) return clampScore(st.role_match);
  if (st?.ats_compatibility != null) return clampScore(st.ats_compatibility);

  // Last resort: average of section scores
  const ss = deriveSectionScores(raw);
  const vals = Object.values(ss).filter((v) => v > 0);
  if (vals.length) return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

  return 0;
}

function deriveStrengths(raw: Record<string, unknown>): string[] {
  // Schema A: executive_summary.top_strengths
  const execA = raw.executive_summary as Record<string, unknown> | undefined;
  const fromA = asStrArray(execA?.top_strengths);
  if (fromA.length) return fromA;

  // Schema B / hybrid: top_strengths (flattened onto root by recruiter function)
  const fromRoot = asStrArray(raw.top_strengths);
  if (fromRoot.length) return fromRoot;

  // Schema B: strengths array
  const fromB = asStrArray(raw.strengths);
  if (fromB.length) return fromB;

  return [];
}

function deriveWeaknesses(raw: Record<string, unknown>): string[] {
  // Schema A: executive_summary.main_risks
  const execA = raw.executive_summary as Record<string, unknown> | undefined;
  const fromA = asStrArray(execA?.main_risks);
  if (fromA.length) return fromA;

  // Schema B: risks / concerns / red_flags
  const fromB = asStrArray(raw.risks ?? raw.concerns ?? raw.red_flags ?? raw.main_risks);
  if (fromB.length) return fromB;

  return [];
}

function deriveIssues(weaknesses: string[], improvements: MappedImprovement[]): string[] {
  // Issues = weaknesses + high-priority improvements that are distinct
  const all = [...weaknesses];
  for (const imp of improvements) {
    if (imp.priority === "high" && imp.description && !all.includes(imp.description)) {
      all.push(imp.description);
    }
  }
  return all;
}

function deriveImprovements(raw: Record<string, unknown>): MappedImprovement[] {
  const qi = raw.quick_improvements;
  if (Array.isArray(qi)) {
    return qi
      .map((item: unknown) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const priority = ["high", "medium", "low"].includes(asStr(obj.priority))
          ? (asStr(obj.priority) as "high" | "medium" | "low")
          : "medium";
        const description = asStr(obj.description || obj.title || obj.issue);
        const action_step = asStr(obj.action_step || obj.fix || obj.action || description);
        if (!description && !action_step) return null;
        return { priority, description, action_step };
      })
      .filter((x): x is MappedImprovement => x !== null);
  }
  return [];
}

function deriveAtsBreakdown(raw: Record<string, unknown>): Record<string, MappedBreakdownItem> {
  // Schema A / engine: ats_breakdown is a {key: {score, current_state, problem, recommended_improvement}} map
  const bd = raw.ats_breakdown as Record<string, unknown> | undefined;
  if (!bd || typeof bd !== "object") return {};

  const result: Record<string, MappedBreakdownItem> = {};
  for (const [k, v] of Object.entries(bd)) {
    if (!v || typeof v !== "object") continue;
    const item = v as Record<string, unknown>;
    result[k] = {
      score: clampScore(item.score),
      current_state: asStr(item.current_state),
      problem: asStr(item.problem),
      recommended_improvement: asStr(item.recommended_improvement),
    };
  }
  return result;
}

function deriveSalary(raw: Record<string, unknown>) {
  const se = raw.salary_estimation as Record<string, unknown> | undefined;
  if (!se) return null;
  const low = Number(se.offer_range_low);
  const high = Number(se.offer_range_high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0) return null;
  return {
    offer_range_low: low,
    offer_range_high: high,
    negotiation_target: Number(se.negotiation_target) || 0,
    walk_away: Number(se.walk_away) || 0,
    anchor: Number(se.anchor) || 0,
  };
}

function deriveCandidateLevel(raw: Record<string, unknown>): "junior" | "mid" | "senior" | "executive" | null {
  const valid = ["junior", "mid", "senior", "executive"] as const;
  const execA = raw.executive_summary as Record<string, unknown> | undefined;
  const level = asStr(execA?.candidate_level || raw.candidate_level || (raw.executive_hiring_summary as any)?.candidate_level);
  return valid.includes(level as typeof valid[number]) ? (level as typeof valid[number]) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map any raw analysis JSON (Job Seeker or Recruiter schema) into a single
 * MappedAnalysis object ready for rendering.
 *
 * @param rawAnalysis  The raw JSON from the database or edge function response.
 *                     May be null / undefined — returns safe empty defaults.
 */
export function mapAnalysisResponse(rawAnalysis: unknown): MappedAnalysis {
  // ── Guard: null / non-object input ────────────────────────────────────────
  if (!rawAnalysis || typeof rawAnalysis !== "object" || Array.isArray(rawAnalysis)) {
    return emptyMappedAnalysis(rawAnalysis);
  }

  const raw = rawAnalysis as Record<string, unknown>;

  const improvements = deriveImprovements(raw);
  const strengths = deriveStrengths(raw);
  const weaknesses = deriveWeaknesses(raw);
  const issues = deriveIssues(weaknesses, improvements);
  const sectionScores = deriveSectionScores(raw);

  // Schema A: executive_summary block
  const execA = raw.executive_summary as Record<string, unknown> | undefined;

  // Schema B: executive_hiring_summary block
  const execB = raw.executive_hiring_summary as Record<string, unknown> | undefined;

  // Schema B: hiring_recommendation block
  const hiringRec = raw.hiring_recommendation as Record<string, unknown> | undefined;

  // Schema A: career_recommendations block
  const careerRec = raw.career_recommendations as Record<string, unknown> | undefined;

  // Schema A: thirty_sixty_ninety_day_plan
  const plan = careerRec?.thirty_sixty_ninety_day_plan as Record<string, unknown> | undefined;

  return {
    overall_score: deriveOverallScore(raw),

    section_scores: sectionScores,
    section_score_items: deriveSectionScoreItems(sectionScores),

    candidate_level: deriveCandidateLevel(raw),
    target_role: firstStr(raw.target_role, execB?.best_fit_roles ? asStrArray(execB.best_fit_roles)[0] : ""),
    candidate_name: firstStr(raw.candidate_name, raw.name),

    summary: firstStr(
      execA?.summary_paragraphs,
      execB?.summary,
      raw.executive_summary_text,
      raw.summary,
    ),

    strengths,
    weaknesses,
    missing_keywords: deriveMissingKeywords(raw),
    issues,
    improvements,

    best_fit_roles: asStrArray(
      execA?.best_fit_roles ?? execB?.best_fit_roles ?? raw.role_fit
    ),
    interview_focus_areas: asStrArray(raw.interview_focus_areas ?? raw.interview_focus),
    missing_requirements: asStrArray(raw.missing_requirements ?? (raw as any).missing_info),

    hiring_decision: firstStr(
      hiringRec?.decision,
      execB?.hiring_decision,
      raw.recommendation,
      raw.fit_label,
    ),
    hiring_reasoning: firstStr(hiringRec?.reasoning),
    why_this_candidate: firstStr(raw.why_this_candidate, strengths[0]),
    why_not_this_candidate: firstStr(raw.why_not_this_candidate, weaknesses[0]),

    ats_breakdown: deriveAtsBreakdown(raw),

    salary: deriveSalary(raw),

    certifications_recommended: asStrArray(careerRec?.certifications_recommended),
    skills_to_improve: asStrArray(careerRec?.skills_to_improve),
    linkedin_improvements: firstStr(careerRec?.linkedin_improvements),

    plan_30_days: firstStr(plan?.thirty_days),
    plan_60_days: firstStr(plan?.sixty_days),
    plan_90_days: firstStr(plan?.ninety_days),

    rewrite_full_resume: firstStr((raw.resume_rewrite as any)?.full_resume),

    interview_questions: Array.isArray(raw.interview_questions)
      ? raw.interview_questions
          .map((q: unknown) => {
            if (!q || typeof q !== "object") return null;
            const obj = q as Record<string, unknown>;
            return {
              question: asStr(obj.question),
              suggested_answer_direction: asStr(obj.suggested_answer_direction),
            };
          })
          .filter((q): q is { question: string; suggested_answer_direction: string } =>
            !!q?.question
          )
      : [],

    _raw: raw,
  };
}

/** Safe empty result when rawAnalysis is null/undefined/invalid */
function emptyMappedAnalysis(raw: unknown): MappedAnalysis {
  return {
    overall_score: 0,
    section_scores: {},
    section_score_items: [],
    candidate_level: null,
    target_role: "",
    candidate_name: "",
    summary: "",
    strengths: [],
    weaknesses: [],
    missing_keywords: [],
    issues: [],
    improvements: [],
    best_fit_roles: [],
    interview_focus_areas: [],
    missing_requirements: [],
    hiring_decision: "",
    hiring_reasoning: "",
    why_this_candidate: "",
    why_not_this_candidate: "",
    ats_breakdown: {},
    salary: null,
    certifications_recommended: [],
    skills_to_improve: [],
    linkedin_improvements: "",
    plan_30_days: "",
    plan_60_days: "",
    plan_90_days: "",
    rewrite_full_resume: "",
    interview_questions: [],
    _raw: raw,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE RE-EXPORTS  — so callers import from one place
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive the display score from a mapped analysis.
 * Replaces the old `deriveAnalysisScore()` in useCandidateAnalysis.ts.
 */
export function deriveMappedScore(mapped: MappedAnalysis): number | null {
  return mapped.overall_score > 0 ? mapped.overall_score : null;
}

/**
 * Build the legacy {weaknesses, suggestions, full_analysis} shape expected by
 * RewriteIssuesCard without modifying that component.
 */
export function toRewriteIssuesProps(mapped: MappedAnalysis) {
  return {
    weaknesses: mapped.weaknesses,
    suggestions: mapped.improvements.map((i) => i.action_step || i.description),
    full_analysis: mapped._raw as Record<string, unknown>,
  };
}

/**
 * Build the legacy {overall_score, full_analysis} shape expected by
 * RewriteSummaryCard without modifying that component.
 */
export function toRewriteSummaryProps(mapped: MappedAnalysis) {
  return {
    overall_score: mapped.overall_score,
    full_analysis: mapped._raw as Record<string, unknown>,
  };
}
