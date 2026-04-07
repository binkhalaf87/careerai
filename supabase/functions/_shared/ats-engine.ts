/**
 * TALENTRY — Deterministic ATS Scoring Engine (Layer A)
 * ══════════════════════════════════════════════════════
 * Pure rule-based scoring. Zero AI. Zero randomness.
 * Same resume text in → identical scores out, every single time.
 *
 * ── OFFICIAL SCORING FORMULA ──────────────────────────────────────────────────
 *
 *   Factor                    Weight   Scorer function
 *   ─────────────────────────────────────────────────
 *   Section completeness       20%     scoreSectionCompleteness()
 *   Skills presence/relevance  20%     scoreSkillsPresence()
 *   Experience clarity         15%     scoreExperienceClarity()
 *   Measurable achievements    15%     scoreMeasurableAchievements()
 *   Keyword coverage           15%     scoreKeywordCoverage()
 *   Formatting & readability   10%     scoreFormatting()
 *   Summary quality             5%     scoreSummaryQuality()
 *   ─────────────────────────────────────────────────
 *   TOTAL                     100%
 *
 * ── RULES ─────────────────────────────────────────────────────────────────────
 *   • overall_score ∈ [0, 100], integer, clamped after weighted sum
 *   • Every factor score ∈ [0, 100], integer, clamped independently
 *   • Every deduction and bonus is a named constant — no magic numbers in logic
 *   • No AI call, no external I/O, no Date.random(), no floating-point surprise
 *   • The AI layer (Layer B) in analysis-core.ts may NOT override any numeric value
 *
 * ── ARCHITECTURE ──────────────────────────────────────────────────────────────
 *   Callers use only:
 *     computeAtsScores(normalized, rawText) → DeterministicScores
 *   Everything else in this file is private implementation.
 */

import type { NormalizedResumeInput } from "./resume-normalizer.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FactorScore {
  /** 0–100 integer */
  score: number;
  /** What the engine observed in the resume */
  current_state: string;
  /** Specific problem found, or empty string if none */
  problem: string;
  /** Exact, actionable fix instruction */
  recommended_improvement: string;
}

export interface DeterministicScores {
  /** Authoritative composite ATS score 0–100. AI must not override. */
  overall_score: number;

  /** Individual factor scores — all 0–100, all deterministic */
  factor_scores: {
    section_completeness: number;    // weight 20%
    skills_presence: number;         // weight 20%
    experience_clarity: number;      // weight 15%
    measurable_achievements: number; // weight 15%
    keyword_coverage: number;        // weight 15%
    formatting: number;              // weight 10%
    summary_quality: number;         // weight  5%
  };

  /** Per-factor detail with narratives — used by AI Layer B for commentary */
  factor_breakdown: {
    section_completeness: FactorScore;
    skills_presence: FactorScore;
    experience_clarity: FactorScore;
    measurable_achievements: FactorScore;
    keyword_coverage: FactorScore;
    formatting: FactorScore;
    summary_quality: FactorScore;
  };

  // ── Legacy aliases ────────────────────────────────────────────────────────
  // Kept so analysis-core.ts mergeAnalysisLayers() and the AI prompt context
  // can reference these without a breaking change.
  /** @alias overall_score */
  ats_score: number;
  /** Maps factors to the NormalizedAnalysis.section_scores schema */
  section_scores: {
    resume_formatting: number;
    keyword_optimization: number;
    experience_quality: number;
    career_progression: number;
    skills_relevance: number;
    education_strength: number;
    contact_information_quality: number;
  };
  /** Legacy ats_breakdown shape expected by mergeAnalysisLayers() */
  ats_breakdown: {
    formatting: FactorScore;
    sections: FactorScore;
    keywords: FactorScore;
    experience: FactorScore;
    education: FactorScore;
    skills: FactorScore;
    contact_info: FactorScore;
  };

  // ── Metadata ──────────────────────────────────────────────────────────────
  candidate_level: "junior" | "mid" | "senior" | "executive";
  years_of_experience: number;
  missing_sections: string[];
  keywords_found: string[];
  keywords_missing_hints: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING WEIGHTS  — edit here and nowhere else
// ═══════════════════════════════════════════════════════════════════════════════

const W = {
  section_completeness:    0.20,
  skills_presence:         0.20,
  experience_clarity:      0.15,
  measurable_achievements: 0.15,
  keyword_coverage:        0.15,
  formatting:              0.10,
  summary_quality:         0.05,
} as const;

// Compile-time guard — if weights don't sum to 1.0 the file won't run cleanly
const _WEIGHT_SUM = Object.values(W).reduce((a, b) => a + b, 0);
if (Math.abs(_WEIGHT_SUM - 1.0) > 0.001) {
  throw new Error(`[ats-engine] Weights must sum to 1.0, got ${_WEIGHT_SUM}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING CONSTANTS — every bonus/deduction is a named value
// ═══════════════════════════════════════════════════════════════════════════════

// Factor: Section Completeness (20%)
const SC = {
  POINTS_PER_SECTION:    20, // 5 sections × 20 = 100
} as const;

// Factor: Skills Presence / Relevance (20%)
const SP = {
  BASE_HAS_SECTION:      30,
  HARD_SKILLS_TIER1:     50, // ≥ 8 hard skills → +50
  HARD_SKILLS_TIER2:     30, // ≥ 4 → +30
  HARD_SKILLS_TIER3:     10, // < 4 → +10
  ITEMS_TIER1:           15, // ≥ 8 items → +15
  ITEMS_TIER2:            5, // ≥ 3 items
  CERTS_BONUS:            5, // certifications section present
  ABSENT_SCORE:          10, // no skills section at all
} as const;

// Factor: Experience Clarity (15%)
const EC = {
  BASE_HAS_SECTION:      40,
  DATES_COMPLETE:        20, // ≥ 2 year markers
  DATES_PARTIAL:          5,
  CURRENTLY_EMPLOYED:    10,
  ROLES_STRUCTURED:      20, // company+title pattern found
  ABSENT_SCORE:           0,
} as const;

// Factor: Measurable Achievements (15%)
const MA = {
  BASE_HAS_EXPERIENCE:   20,
  QUANTIFIED_BONUS:      30, // has %, SAR, or numeric impact
  VERB_TIER1:            30, // ≥ 5 achievement verbs → +30
  VERB_TIER2:            15, // ≥ 2 → +15
  VERB_TIER3:             0,
  BULLETS_TIER1:         20, // ≥ 6 bullets → +20
  BULLETS_TIER2:         10, // ≥ 2 → +10
  ABSENT_SCORE:           0,
} as const;

// Factor: Keyword Coverage (15%)
const KC = {
  TARGET_COUNT:          20, // 20 keywords = full score
} as const;

// Factor: Formatting & Readability (10%)
const FR = {
  BASE:                 100,
  SHORT_RESUME:         -30, // < 200 words
  LONG_RESUME:          -15, // > 1200 words
  BROKEN_LINES:         -20, // > 50% short lines
  DUTY_LANGUAGE:        -10, // per 3 occurrences of "responsible for", capped -20
  TABLE_LAYOUT:         -15, // > 10 pipe chars
} as const;

// Factor: Summary Quality (5%)
const SQ = {
  ABSENT_SCORE:           0,
  BASE_HAS_SUMMARY:      30,
  WORD_COUNT_TIER1:      40, // 30–150 words → +40
  WORD_COUNT_TIER2:      20, // 10–30 words → +20
  FIRST_PERSON_PENALTY: -10, // "I am", "I have" in first sentence
  GENERIC_PENALTY:      -15, // banned openers detected
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ATS KEYWORD BANKS
// ═══════════════════════════════════════════════════════════════════════════════

const UNIVERSAL_KEYWORDS = [
  "achieved", "delivered", "improved", "increased", "reduced", "led", "managed",
  "developed", "implemented", "launched", "optimized", "grew", "generated",
  "حقق", "أنجز", "طور", "قاد", "أدار", "نفّذ", "حسّن", "أطلق", "زاد", "خفّض",
  "%", "SAR", "million", "thousand", "مليون", "ألف", "ريال",
  "linkedin", "github", "portfolio",
] as const;

const DOMAIN_KEYWORDS: Record<string, readonly string[]> = {
  tech: [
    "python", "javascript", "typescript", "react", "node", "aws", "azure", "docker",
    "kubernetes", "sql", "postgresql", "mongodb", "api", "rest", "graphql", "git",
    "ci/cd", "agile", "scrum", "microservices", "cloud", "devops", "linux",
  ],
  finance: [
    "financial analysis", "budgeting", "forecasting", "p&l", "variance analysis",
    "ifrs", "gaap", "excel", "power bi", "erp", "sap", "oracle", "audit", "cfa",
    "cpa", "cma", "vision 2030", "zakat", "vat", "cash flow", "balance sheet",
  ],
  hr: [
    "talent acquisition", "recruitment", "onboarding", "hris", "performance management",
    "learning development", "employee relations", "workforce planning", "saudization",
    "nitaqat", "gosi", "labor law", "organizational development", "succession planning",
  ],
  marketing: [
    "digital marketing", "seo", "sem", "google analytics", "social media", "content strategy",
    "brand management", "campaign", "crm", "hubspot", "salesforce", "kpi", "roi",
    "market research", "customer acquisition", "retention",
  ],
  operations: [
    "supply chain", "logistics", "procurement", "vendor management", "lean", "six sigma",
    "process improvement", "kpi", "sla", "erp", "sap", "inventory management",
    "quality assurance", "iso", "project management", "pmp",
  ],
  engineering: [
    "autocad", "solidworks", "project management", "pmp", "iso", "safety", "hse",
    "mechanical", "electrical", "civil", "structural", "commissioning", "maintenance",
    "reliability", "asset management", "neom", "aramco", "sabic",
  ],
  general: [
    "microsoft office", "communication", "teamwork", "problem solving",
    "project management", "time management", "analytical", "customer service",
    "leadership", "bilingual", "arabic", "english",
  ],
} as const;

const ALL_KEYWORDS: string[] = [
  ...UNIVERSAL_KEYWORDS,
  ...Object.values(DOMAIN_KEYWORDS).flat(),
];

const ACHIEVEMENT_VERBS = [
  "achieved", "delivered", "improved", "increased", "reduced", "led", "managed",
  "developed", "implemented", "launched", "optimized", "grew", "generated", "built",
  "designed", "created", "established", "transformed", "negotiated", "secured",
  "حقق", "أنجز", "طور", "قاد", "أدار", "نفّذ", "حسّن", "أطلق", "زاد", "خفّض", "بنى",
] as const;

const GENERIC_SUMMARY_OPENERS = [
  "i am a", "i am an", "i have", "highly motivated", "results-driven",
  "passionate about", "seeking a", "seeking an", "looking for",
  "i am looking", "dynamic professional", "hard-working",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countInText(haystack: string, needles: readonly string[]): number {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => lower.includes(n.toLowerCase())).length;
}

function detectYearsOfExperience(text: string): number {
  const lower = text.toLowerCase();

  // Explicit statement: "10 years of experience", "10+ years"
  const explicit = lower.match(/(\d+)\s*\+?\s*years?\s+(of\s+)?experience/i);
  if (explicit) return parseInt(explicit[1], 10);

  // Sum date ranges: "2018 – 2023", "Mar 2019 – Present"
  const currentYear = new Date().getFullYear();
  const ranges = [...lower.matchAll(/20(\d{2})\s*[-–—]\s*(20(\d{2})|present|now|حالياً|الآن)/gi)];

  if (ranges.length > 0) {
    let months = 0;
    for (const m of ranges) {
      const start = 2000 + parseInt(m[1], 10);
      const isPresent = /present|now|حالي/i.test(m[2]);
      const end = isPresent ? currentYear : 2000 + parseInt(m[3] ?? "0", 10);
      if (end >= start && start > 1990 && end <= currentYear + 1) {
        months += (end - start) * 12;
      }
    }
    if (months > 0) return Math.min(50, Math.round(months / 12));
  }

  return 0;
}

function inferLevel(years: number): "junior" | "mid" | "senior" | "executive" {
  if (years < 3) return "junior";
  if (years < 7) return "mid";
  if (years < 15) return "senior";
  return "executive";
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTOR SCORERS  (private — only computeAtsScores() is exported)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Factor 1: Section Completeness (20%) ─────────────────────────────────────
// 5 required sections × 20 points each = 100 max.
// Partial credit: section is present AND has > 10 chars of content.
function scoreSectionCompleteness(n: NormalizedResumeInput): FactorScore {
  const SECTIONS = [
    { label: "Summary",        value: n.summary },
    { label: "Experience",     value: n.experience },
    { label: "Skills",         value: n.skills },
    { label: "Education",      value: n.education },
    { label: "Certifications", value: n.certifications },
  ];

  const present = SECTIONS.filter((s) => (s.value ?? "").trim().length > 10);
  const missing = SECTIONS.filter((s) => (s.value ?? "").trim().length <= 10);

  const score = clamp(present.length * SC.POINTS_PER_SECTION);

  return {
    score,
    current_state: present.length === SECTIONS.length
      ? "All 5 required sections present"
      : `${present.length}/5 sections present: ${present.map((s) => s.label).join(", ")}`,
    problem: missing.length
      ? `Missing: ${missing.map((s) => s.label).join(", ")}`
      : "",
    recommended_improvement: missing.length
      ? `Add these sections with clear headings: ${missing.map((s) => s.label).join(", ")}`
      : "Section structure is complete.",
  };
}

// ── Factor 2: Skills Presence & Relevance (20%) ───────────────────────────────
// Starts at 0. Base for having a section. Then hard-skill count tiers.
// Max without section: 10. Max with section: 100.
function scoreSkillsPresence(n: NormalizedResumeInput, rawText: string): FactorScore {
  const skillsText = n.skills ?? "";

  if (!skillsText.trim()) {
    return {
      score: SP.ABSENT_SCORE,
      current_state: "No dedicated Skills section detected",
      problem: "Skills section is absent — ATS keyword matching fails without it",
      recommended_improvement: 'Add a "Skills" or "Core Competencies" section listing 8–18 specific tools, technologies, and methodologies',
    };
  }

  let score = SP.BASE_HAS_SECTION;
  const problems: string[] = [];

  // Hard skill count against all domain banks (not general/universal — those are too easy)
  const domainKeywords = [
    ...DOMAIN_KEYWORDS.tech,
    ...DOMAIN_KEYWORDS.finance,
    ...DOMAIN_KEYWORDS.hr,
    ...DOMAIN_KEYWORDS.operations,
    ...DOMAIN_KEYWORDS.engineering,
    ...DOMAIN_KEYWORDS.marketing,
  ];
  const combined = (skillsText + " " + rawText).toLowerCase();
  const hardCount = countInText(combined, domainKeywords);

  if (hardCount >= 8) {
    score += SP.HARD_SKILLS_TIER1;
  } else if (hardCount >= 4) {
    score += SP.HARD_SKILLS_TIER2;
    problems.push(`Only ${hardCount} domain-specific skills detected — target 8+ role-relevant tools/technologies`);
  } else {
    score += SP.HARD_SKILLS_TIER3;
    problems.push(`Very few specific skills (${hardCount}) — replace generic terms with named tools, platforms, and methodologies`);
  }

  // Item count in skills section
  const itemCount = skillsText.split("\n").filter((l) => l.trim().length > 1).length;
  if (itemCount >= 8) {
    score += SP.ITEMS_TIER1;
  } else if (itemCount >= 3) {
    score += SP.ITEMS_TIER2;
  } else {
    problems.push(`Skills section lists only ${itemCount} items — expand to 8–18 entries`);
  }

  // Certification bonus
  if ((n.certifications ?? "").trim().length > 10) {
    score += SP.CERTS_BONUS;
  }

  return {
    score: clamp(score),
    current_state: `${itemCount} skills listed | ${hardCount} domain-specific keywords detected`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? problems[0]
      : "Skills section is well-populated with relevant terms.",
  };
}

// ── Factor 3: Experience Clarity (15%) ───────────────────────────────────────
// Does the experience section clearly show WHO, WHAT, WHEN?
// Scores: has section + dates present + current employment + structured roles.
function scoreExperienceClarity(n: NormalizedResumeInput, years: number): FactorScore {
  const exp = n.experience ?? "";

  if (!exp.trim()) {
    return {
      score: EC.ABSENT_SCORE,
      current_state: "No experience section detected",
      problem: "Absent experience section causes immediate ATS rejection",
      recommended_improvement: 'Add an "Experience" section: Company | Job Title | City | Dates, followed by bullet points',
    };
  }

  let score = EC.BASE_HAS_SECTION;
  const problems: string[] = [];

  // Date coverage
  const yearMarkers = (exp.match(/20\d{2}/g) ?? []).length;
  if (yearMarkers >= 2) {
    score += EC.DATES_COMPLETE;
  } else if (yearMarkers === 1) {
    score += EC.DATES_PARTIAL;
    problems.push("Only 1 year marker found — every role must show start and end year");
  } else {
    problems.push("No year markers found — add employment dates in YYYY format for each role");
  }

  // Currently employed signal
  const isCurrentlyEmployed = /present|now|current|حالياً|الآن/i.test(exp);
  if (isCurrentlyEmployed) {
    score += EC.CURRENTLY_EMPLOYED;
  }

  // Role structure: company + title pattern (line with 2–5 words followed by date-like line)
  const hasCompanyPattern = /\b(inc|llc|ltd|co\.|company|group|corp|شركة|مجموعة|مؤسسة)\b/i.test(exp)
    || exp.split("\n").some((l) => l.trim().length > 5 && l.trim().length < 80 && /20\d{2}/.test(l));
  if (hasCompanyPattern) {
    score += EC.ROLES_STRUCTURED;
  } else {
    problems.push("Role structure unclear — format each entry as: Company | Title | Dates");
  }

  return {
    score: clamp(score),
    current_state: `~${years} yrs experience | ${yearMarkers} year markers | current: ${isCurrentlyEmployed ? "yes" : "unclear"}`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? problems[0]
      : "Experience section has clear structure with dates and employers.",
  };
}

// ── Factor 4: Measurable Achievements (15%) ───────────────────────────────────
// Are bullet points achievement-oriented with numbers, verbs, and impact?
function scoreMeasurableAchievements(n: NormalizedResumeInput): FactorScore {
  const exp = n.experience ?? "";

  if (!exp.trim()) {
    return {
      score: MA.ABSENT_SCORE,
      current_state: "No experience section — achievements cannot be assessed",
      problem: "Add an experience section before achievement scoring can apply",
      recommended_improvement: 'Add experience with STAR-format bullets: Situation/Action → Result (quantified)',
    };
  }

  let score = MA.BASE_HAS_EXPERIENCE;
  const problems: string[] = [];

  // Quantification: %, SAR, dollar amounts, headcount figures
  const hasQuantification = /\d+\s*%|\d+\s*(SAR|USD|K|million|thousand|مليون|ألف|ريال)|managed\s+\d+|\d+\s+(people|employees|team|clients|projects|موظف|عميل|مشروع)/i.test(exp);
  if (hasQuantification) {
    score += MA.QUANTIFIED_BONUS;
  } else {
    problems.push("No quantified results found — add % improvements, SAR figures, or headcount numbers to at least 3 bullets");
  }

  // Achievement verb count
  const verbCount = countInText(exp, ACHIEVEMENT_VERBS);
  if (verbCount >= 5) {
    score += MA.VERB_TIER1;
  } else if (verbCount >= 2) {
    score += MA.VERB_TIER2;
    problems.push(`Only ${verbCount} achievement verbs found — target 5+ per role (Led, Delivered, Reduced, etc.)`);
  } else {
    score += MA.VERB_TIER3;
    problems.push('Duty-listing language dominates — replace "Responsible for" with action verbs: Led, Built, Reduced, Delivered');
  }

  // Bullet point count
  const bulletCount = exp.split("\n").filter((l) => /^[•▪◦\-*]\s/.test(l.trim())).length;
  if (bulletCount >= 6) {
    score += MA.BULLETS_TIER1;
  } else if (bulletCount >= 2) {
    score += MA.BULLETS_TIER2;
    problems.push(`Only ${bulletCount} bullet points — use 4–6 bullets per role for ATS readability`);
  } else {
    problems.push("No bullet points detected — structure each role with 4–6 achievement bullets");
  }

  return {
    score: clamp(score),
    current_state: `${bulletCount} bullets | ${verbCount} achievement verbs | quantification: ${hasQuantification ? "yes" : "no"}`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? problems[0]
      : "Achievements are quantified and use strong action verbs.",
  };
}

// ── Factor 5: Keyword Coverage (15%) ─────────────────────────────────────────
// How many ATS-critical keywords appear in the resume?
// Score = min(found / TARGET_COUNT, 1) × 100
function scoreKeywordCoverage(fullText: string): FactorScore & {
  keywords_found: string[];
  keywords_missing_hints: string[];
} {
  const lower = fullText.toLowerCase();
  const found = ALL_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
  const missing = ALL_KEYWORDS.filter((kw) => !lower.includes(kw.toLowerCase()));

  const score = clamp(Math.round((found.length / KC.TARGET_COUNT) * 100));

  // Prioritise general/universal missing keywords as hints (most impactful)
  const missingHints = missing
    .filter((kw) =>
      (DOMAIN_KEYWORDS.general as readonly string[]).includes(kw) ||
      (UNIVERSAL_KEYWORDS as readonly string[]).includes(kw)
    )
    .slice(0, 8);

  const problem = found.length < 10
    ? `Low keyword density (${found.length}/${KC.TARGET_COUNT}). Top missing: ${missingHints.slice(0, 5).join(", ")}`
    : found.length < KC.TARGET_COUNT
    ? `Moderate coverage (${found.length}/${KC.TARGET_COUNT}) — add role-specific terms`
    : "";

  return {
    score,
    current_state: `${found.length} of ${KC.TARGET_COUNT} target ATS keywords detected`,
    problem,
    recommended_improvement: missingHints.length
      ? `Add to Skills or Summary: ${missingHints.slice(0, 5).join(", ")}`
      : "Keyword coverage meets ATS threshold.",
    keywords_found: found,
    keywords_missing_hints: missingHints,
  };
}

// ── Factor 6: Formatting & Readability (10%) ──────────────────────────────────
// Starts at 100. Named deductions for each detected issue.
function scoreFormatting(rawText: string): FactorScore {
  let score = FR.BASE;
  const problems: string[] = [];

  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 200) {
    score += FR.SHORT_RESUME;
    problems.push(`Resume is very short (${wordCount} words — ideal: 300–900)`);
  } else if (wordCount > 1200) {
    score += FR.LONG_RESUME;
    problems.push(`Resume is too long (${wordCount} words — trim to 1–2 pages / 300–900 words)`);
  }

  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
  const shortLines = lines.filter((l) => l.trim().length < 25 && !/^\d{4}/.test(l.trim())).length;
  if (lines.length > 0 && shortLines / lines.length > 0.5) {
    score += FR.BROKEN_LINES;
    problems.push(`${shortLines}/${lines.length} lines are very short — broken extraction may cause ATS parsing failures`);
  }

  const lower = rawText.toLowerCase();
  const dutyCount = (lower.match(/responsible for/g) ?? []).length;
  if (dutyCount > 0) {
    // -10 per 3 occurrences, capped at -20
    const deduction = Math.min(20, Math.floor(dutyCount / 3) * 10 + (dutyCount % 3 > 0 ? 10 : 0));
    score += -deduction;
    problems.push(`"Responsible for" appears ${dutyCount} times — replace with achievement verbs`);
  }

  const pipeCount = (rawText.match(/\|/g) ?? []).length;
  if (pipeCount > 10) {
    score += FR.TABLE_LAYOUT;
    problems.push(`${pipeCount} pipe characters suggest table-based layout — tables break most ATS parsers`);
  }

  return {
    score: clamp(score),
    current_state: `${wordCount} words | ${lines.length} lines | ${shortLines} short lines | ${pipeCount} pipe chars`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? problems[0]
      : "Formatting is clean and ATS-compatible.",
  };
}

// ── Factor 7: Summary Quality (5%) ────────────────────────────────────────────
// Does the summary exist, have appropriate length, and avoid generic openers?
function scoreSummaryQuality(n: NormalizedResumeInput): FactorScore {
  const summary = (n.summary ?? "").trim();

  if (!summary) {
    return {
      score: SQ.ABSENT_SCORE,
      current_state: "No professional summary detected",
      problem: "Summary section is absent — recruiters and ATS expect a 2–4 sentence professional statement",
      recommended_improvement: 'Add a "Professional Summary" (30–150 words): [Years] of experience in [domain] delivering [key achievement]. Specialising in [top skill 1], [top skill 2], and [top skill 3].',
    };
  }

  let score = SQ.BASE_HAS_SUMMARY;
  const problems: string[] = [];

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 30 && wordCount <= 150) {
    score += SQ.WORD_COUNT_TIER1;
  } else if (wordCount >= 10) {
    score += SQ.WORD_COUNT_TIER2;
    if (wordCount < 30) {
      problems.push(`Summary is too brief (${wordCount} words) — expand to 30–150 words`);
    } else {
      problems.push(`Summary is too long (${wordCount} words) — trim to 30–150 words`);
    }
  } else {
    problems.push(`Summary is too short (${wordCount} words) — write 30–150 words`);
  }

  // First-person opener penalty
  const firstLine = summary.toLowerCase().slice(0, 80);
  if (/\bi am\b|\bi have\b/i.test(firstLine)) {
    score += SQ.FIRST_PERSON_PENALTY;
    problems.push('Summary opens with "I am" or "I have" — lead with your title and years instead');
  }

  // Generic opener penalty
  if (GENERIC_SUMMARY_OPENERS.some((p) => firstLine.includes(p))) {
    score += SQ.GENERIC_PENALTY;
    problems.push("Generic summary opener detected — start with a specific value statement");
  }

  return {
    score: clamp(score),
    current_state: `${wordCount}-word summary present`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? problems[0]
      : "Summary is well-formed and appropriately concise.",
  };
}

// ── Education detail (used by legacy ats_breakdown only) ──────────────────────
function scoreEducationDetail(n: NormalizedResumeInput): FactorScore {
  const edu = (n.education ?? "").trim();

  if (!edu) {
    return {
      score: 30,
      current_state: "No education section detected",
      problem: "Education section is missing — most GCC ATS systems filter on degree",
      recommended_improvement: 'Add an "Education" section: Degree | Institution | Year',
    };
  }

  let score = 50;
  const problems: string[] = [];

  const hasDegree = /bachelor|master|phd|diploma|degree|بكالوريوس|ماجستير|دكتوراه|دبلوم/i.test(edu);
  const hasYear = /20\d{2}|19\d{2}/.test(edu);
  const hasInstitution = /university|college|institute|school|جامعة|كلية|معهد/i.test(edu);

  if (hasDegree) score += 20; else problems.push("No degree type stated");
  if (hasYear) score += 15; else problems.push("No graduation year");
  if (hasInstitution) score += 15; else problems.push("No institution name");

  return {
    score: clamp(score),
    current_state: `Degree: ${hasDegree ? "✓" : "✗"} | Institution: ${hasInstitution ? "✓" : "✗"} | Year: ${hasYear ? "✓" : "✗"}`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? `Add to education entry: ${problems.join(", ")}`
      : "Education entry is complete.",
  };
}

// ── Contact detail (used by legacy ats_breakdown only) ───────────────────────
function scoreContactDetail(n: NormalizedResumeInput, rawText: string): FactorScore {
  let score = 0;
  const problems: string[] = [];
  const raw = (n.raw_text + " " + rawText).toLowerCase();

  const hasEmail = /@/.test(raw);
  const hasPhone = /\+?\d[\d\s\-()]{7,}/.test(raw);
  const hasLinkedIn = /linkedin\.com/.test(raw);
  const hasLocation = /riyadh|jeddah|dammam|khobar|mecca|medina|الرياض|جدة|الدمام|مكة|المدينة|saudi|ksa|uae|dubai/i.test(raw);
  const hasName = !!n.name;

  if (hasName) score += 20; else problems.push("Full name not in header");
  if (hasEmail) score += 30; else problems.push("No email");
  if (hasPhone) score += 25; else problems.push("No phone number");
  if (hasLinkedIn) score += 15; else problems.push("No LinkedIn URL");
  if (hasLocation) score += 10; else problems.push("No city/country");

  return {
    score: clamp(score),
    current_state: `Name:${hasName ? "✓" : "✗"} Email:${hasEmail ? "✓" : "✗"} Phone:${hasPhone ? "✓" : "✗"} LinkedIn:${hasLinkedIn ? "✓" : "✗"} Location:${hasLocation ? "✓" : "✗"}`,
    problem: problems.join("; "),
    recommended_improvement: problems.length
      ? `Add to resume header: ${problems.join(", ")}`
      : "Contact information is complete.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

export function computeAtsScores(
  normalized: NormalizedResumeInput,
  rawText: string
): DeterministicScores {
  const fullText = normalized.raw_text + " " + rawText;
  const years = detectYearsOfExperience(fullText);
  const level = inferLevel(years);

  // ── Run all 7 factor scorers ────────────────────────────────────────────────
  const f_sections    = scoreSectionCompleteness(normalized);
  const f_skills      = scoreSkillsPresence(normalized, rawText);
  const f_clarity     = scoreExperienceClarity(normalized, years);
  const f_achieve     = scoreMeasurableAchievements(normalized);
  const f_keywords    = scoreKeywordCoverage(fullText);
  const f_format      = scoreFormatting(normalized.raw_text || rawText);
  const f_summary     = scoreSummaryQuality(normalized);

  // ── Factor scores (named, typed, clamped) ───────────────────────────────────
  const factor_scores = {
    section_completeness:    f_sections.score,
    skills_presence:         f_skills.score,
    experience_clarity:      f_clarity.score,
    measurable_achievements: f_achieve.score,
    keyword_coverage:        f_keywords.score,
    formatting:              f_format.score,
    summary_quality:         f_summary.score,
  };

  // ── Weighted composite — the ONLY formula that produces overall_score ────────
  const overall_score = clamp(
    Math.round(
      factor_scores.section_completeness    * W.section_completeness    +
      factor_scores.skills_presence         * W.skills_presence         +
      factor_scores.experience_clarity      * W.experience_clarity      +
      factor_scores.measurable_achievements * W.measurable_achievements +
      factor_scores.keyword_coverage        * W.keyword_coverage        +
      factor_scores.formatting              * W.formatting              +
      factor_scores.summary_quality         * W.summary_quality
    )
  );

  // ── Collect metadata ────────────────────────────────────────────────────────
  const missing_sections: string[] = [];
  if (!normalized.summary)        missing_sections.push("Summary");
  if (!normalized.experience)     missing_sections.push("Experience");
  if (!normalized.skills)         missing_sections.push("Skills");
  if (!normalized.education)      missing_sections.push("Education");
  if (!normalized.certifications) missing_sections.push("Certifications");

  // ── Legacy aliases (required by analysis-core.ts and AI prompt) ─────────────
  const educationDetail = scoreEducationDetail(normalized);
  const contactDetail   = scoreContactDetail(normalized, rawText);

  const section_scores = {
    resume_formatting:           f_format.score,
    keyword_optimization:        f_keywords.score,
    experience_quality:          f_achieve.score,    // best mapping: achievements → experience quality
    career_progression:          f_clarity.score,    // best mapping: clarity → progression readability
    skills_relevance:            f_skills.score,
    education_strength:          educationDetail.score,
    contact_information_quality: contactDetail.score,
  };

  return {
    // ── New canonical output ──
    overall_score,
    factor_scores,
    factor_breakdown: {
      section_completeness:    f_sections,
      skills_presence:         f_skills,
      experience_clarity:      f_clarity,
      measurable_achievements: f_achieve,
      keyword_coverage:        f_keywords,
      formatting:              f_format,
      summary_quality:         f_summary,
    },

    // ── Legacy aliases ────────
    ats_score: overall_score,
    section_scores,
    ats_breakdown: {
      formatting:   f_format,
      sections:     f_sections,
      keywords:     f_keywords,
      experience:   f_achieve,
      education:    educationDetail,
      skills:       f_skills,
      contact_info: contactDetail,
    },

    // ── Metadata ──────────────
    candidate_level:         level,
    years_of_experience:     years,
    missing_sections,
    keywords_found:          f_keywords.keywords_found,
    keywords_missing_hints:  f_keywords.keywords_missing_hints,
  };
}
