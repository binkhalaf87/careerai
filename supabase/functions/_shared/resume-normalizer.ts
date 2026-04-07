/**
 * TALENTRY — Deterministic Resume Normalizer (Deno-compatible)
 * ─────────────────────────────────────────────────────────────
 * Pure TypeScript. Zero dependencies. No AI calls.
 *
 * Used by callAnalysisAI() BEFORE the text reaches buildPrompt(),
 * guaranteeing both Job Seeker and Recruiter flows receive the
 * same cleaned, structured input regardless of extraction source.
 *
 * CONTRACT:
 *   - Input:  raw string from any PDF/DOCX extraction (messy, broken lines, noise)
 *   - Output: NormalizedResumeInput — structured fields + cleaned raw_text
 *   - Missing sections → null  (never hallucinated)
 *   - raw_text is always returned unchanged after basic whitespace cleanup
 *
 * EDITING RULES:
 *   - Never call an AI API from this file.
 *   - Keep all logic deterministic (same input → same output, always).
 *   - Do NOT import from src/ — this runs in Deno, not the browser bundle.
 */

// ─── Output schema ────────────────────────────────────────────────────────────

export interface NormalizedResumeInput {
  /** Candidate full name extracted from header. null if undetectable. */
  name: string | null;
  /** Most recent or stated job title. null if undetectable. */
  job_title: string | null;
  /** Professional summary / objective section text. null if absent. */
  summary: string | null;
  /** Skills section text (bullet-cleaned, deduplicated). null if absent. */
  skills: string | null;
  /** Work experience section text. null if absent. */
  experience: string | null;
  /** Education section text. null if absent. */
  education: string | null;
  /** Certifications section text. null if absent. */
  certifications: string | null;
  /**
   * Full cleaned text ready for AI prompt injection.
   * Always present. This is what buildPrompt() receives.
   */
  raw_text: string;
}

// ─── Section detection patterns ───────────────────────────────────────────────

type SectionKey = "summary" | "experience" | "skills" | "education" | "certifications";

const SECTION_PATTERNS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  {
    key: "summary",
    patterns: [
      /^professional\s+summary$/i,
      /^summary$/i,
      /^profile$/i,
      /^career\s+summary$/i,
      /^objective$/i,
      /^career\s+objective$/i,
      /^about\s+me$/i,
      /^نبذة$/i,
      /^نبذه$/i,
      /^الملخص$/i,
      /^الملخص\s+المهني$/i,
      /^الهدف\s+الوظيفي$/i,
      /^نبذة\s+مهنية$/i,
      /^ملخص\s+مهني$/i,
    ],
  },
  {
    key: "experience",
    patterns: [
      /^experience$/i,
      /^work\s+experience$/i,
      /^employment(\s+history)?$/i,
      /^professional\s+experience$/i,
      /^career\s+history$/i,
      /^work\s+history$/i,
      /^الخبرات?$/i,
      /^الخبرات?\s+العملية$/i,
      /^السجل\s+الوظيفي$/i,
      /^الخبرة\s+المهنية$/i,
    ],
  },
  {
    key: "skills",
    patterns: [
      /^skills$/i,
      /^technical\s+skills$/i,
      /^key\s+skills$/i,
      /^core\s+competencies$/i,
      /^competencies$/i,
      /^مهارات$/i,
      /^المهارات$/i,
      /^المهارات\s+التقنية$/i,
      /^الكفاءات$/i,
      /^المهارات\s+الأساسية$/i,
    ],
  },
  {
    key: "education",
    patterns: [
      /^education$/i,
      /^academic\s+background$/i,
      /^qualifications?$/i,
      /^academic\s+qualifications?$/i,
      /^التعليم$/i,
      /^المؤهلات?$/i,
      /^المؤهلات?\s+العلمية$/i,
      /^التحصيل\s+العلمي$/i,
      /^الخلفية\s+الأكاديمية$/i,
    ],
  },
  {
    key: "certifications",
    patterns: [
      /^certifications?$/i,
      /^certificates?$/i,
      /^licenses?$/i,
      /^courses?$/i,
      /^training$/i,
      /^الشهادات?$/i,
      /^الشهادات?\s+المهنية$/i,
      /^الدورات?$/i,
      /^الدورات?\s+التدريبية$/i,
      /^الرخص$/i,
      /^الاعتمادات$/i,
    ],
  },
];

// Lines that are pure document noise — drop them entirely
const NOISE_PATTERNS: RegExp[] = [
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^صفحة\s+\d+$/i,
  /^\d+\s*\/\s*\d+$/,           // "1 / 2"
  /^curriculum\s+vitae$/i,
  /^resume$/i,
  /^\s*cv\s*$/i,
  /^-{3,}$/,                     // "------"
  /^={3,}$/,                     // "======"
  /^_{3,}$/,                     // "______"
  /^\*{3,}$/,                    // "******"
];

// ─── Low-level text cleaning ──────────────────────────────────────────────────

/** Remove zero-width characters, BOM, and normalize whitespace */
function stripInvisible(text: string): string {
  return text
    .replace(/\x00/g, "")
    .replace(/\u200B/g, "")   // zero-width space
    .replace(/\u200C/g, "")   // zero-width non-joiner
    .replace(/\u200D/g, "")   // zero-width joiner
    .replace(/\uFEFF/g, "")   // BOM
    .replace(/\u00A0/g, " ")  // non-breaking space → regular space
    .replace(/\t/g, " ");     // tabs → space
}

/** Collapse consecutive spaces on a single line to one */
function collapseSpaces(line: string): string {
  return line.replace(/[ ]+/g, " ").trim();
}

/** Strip heading-decoration characters and trailing punctuation */
function normalizeHeadingText(line: string): string {
  return line
    .replace(/^#+\s*/, "")          // markdown headings
    .replace(/[:：\-–—]+$/, "")    // trailing colons / dashes
    .replace(/[|]+/g, " ")          // pipe separators
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Section heading detection ────────────────────────────────────────────────

function detectSection(line: string): SectionKey | null {
  const normalized = normalizeHeadingText(line);
  if (!normalized || normalized.length > 60) return null;
  for (const item of SECTION_PATTERNS) {
    if (item.patterns.some((rx) => rx.test(normalized))) return item.key;
  }
  return null;
}

// ─── Header field inference ───────────────────────────────────────────────────

function looksLikeContact(line: string): boolean {
  return (
    /@/.test(line) ||
    /\+?\d[\d\s\-()]{6,}/.test(line) ||
    /linkedin|github|portfolio/i.test(line) ||
    /riyadh|jeddah|saudi|ksa|uae|dubai|الرياض|جدة|السعودية|الإمارات/i.test(line) ||
    /^(phone|email|mobile|tel|address|الهاتف|البريد|الموقع)\s*:/i.test(line)
  );
}

function looksLikeName(line: string): boolean {
  if (!line || line.length > 55) return false;
  if (looksLikeContact(line)) return false;
  if (detectSection(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;

  // Latin names or Arabic names — no digits, no special symbols beyond hyphens/apostrophes
  return /^[A-Za-z\u0600-\u06FF\s.\-']+$/.test(line);
}

function looksLikeJobTitle(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (looksLikeContact(line)) return false;
  if (detectSection(line)) return false;

  return /engineer|manager|specialist|supervisor|analyst|developer|consultant|officer|lead|director|coordinator|assistant|administrator|architect|designer|executive|مهندس|مدير|أخصائي|مشرف|محلل|مطور|استشاري|فني|منسق|مساعد|مسؤول|مصمم|قائد/i.test(
    line
  );
}

// ─── Line-merge heuristic ─────────────────────────────────────────────────────
//
// Many PDF extractors break mid-sentence. We merge a line into the previous one
// when:
//   - The previous line ends with a soft connector (, ; : - –) OR is short (<55 chars)
//   - The current line does NOT start a new bullet, contact, name, title, or section
//
function mergeWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (!out.length) { out.push(line); continue; }

    const prev = out[out.length - 1];
    const startsNewItem =
      /^[•▪◦*\-]/.test(line) ||
      looksLikeContact(line) ||
      looksLikeName(line) ||
      looksLikeJobTitle(line) ||
      !!detectSection(line);

    const prevIsSoft = /[,;/:\-–—]$/.test(prev) || prev.length < 55;

    if (prevIsSoft && !startsNewItem) {
      out[out.length - 1] = `${prev} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      out.push(line);
    }
  }
  return out;
}

// ─── Bullet normalization ─────────────────────────────────────────────────────

function normalizeBullets(text: string): string {
  const lines = text.split("\n").map((l) => collapseSpaces(l)).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const clean = line.replace(/^[•▪◦*\-]\s*/, "").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    result.push(clean);
  }

  return result.join("\n");
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

export function normalizeResumeText(rawText: string): NormalizedResumeInput {
  // ── 1. Null / empty guard ─────────────────────────────────────────────────
  if (!rawText || !rawText.trim()) {
    return {
      name: null,
      job_title: null,
      summary: null,
      skills: null,
      experience: null,
      education: null,
      certifications: null,
      raw_text: "",
    };
  }

  // ── 2. Basic text cleaning — applied globally ─────────────────────────────
  const cleaned = stripInvisible(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove PDF artifact patterns: "•• " repeated, "| | |", "_ _ _"
    .replace(/([•|_])\s*\1(\s*\1)*/g, "$1")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n");

  // ── 3. Split into lines, clean each, drop noise ───────────────────────────
  const rawLines = cleaned
    .split("\n")
    .map((l) => collapseSpaces(stripInvisible(l)))
    .filter((l) => {
      if (!l) return false;
      if (NOISE_PATTERNS.some((rx) => rx.test(l))) return false;
      // Drop lines that are pure punctuation or single characters
      if (/^[^\w\u0600-\u06FF]+$/.test(l) && l.length < 4) return false;
      return true;
    });

  // ── 4. Merge broken/wrapped lines ────────────────────────────────────────
  const lines = mergeWrappedLines(rawLines);

  // ── 5. Build clean raw_text (for AI prompt injection) ────────────────────
  const raw_text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // ── 6. Accumulate section buckets ────────────────────────────────────────
  const buckets: Record<SectionKey, string[]> = {
    summary: [],
    experience: [],
    skills: [],
    education: [],
    certifications: [],
  };

  let name: string | null = null;
  let job_title: string | null = null;
  let currentSection: SectionKey | null = null;
  let headerZone = true;   // first 10 lines — header inference active
  let lineIdx = 0;

  for (const line of lines) {
    lineIdx++;
    if (lineIdx > 10) headerZone = false;

    // ── Section heading detection ────────────────────────────────────────
    const sectionKey = detectSection(line);
    if (sectionKey) {
      currentSection = sectionKey;
      headerZone = false;
      continue;
    }

    // ── Header zone: extract name + job_title ───────────────────────────
    if (headerZone) {
      if (!name && looksLikeName(line)) { name = line; continue; }
      if (!job_title && looksLikeJobTitle(line)) { job_title = line; continue; }
      // Contact lines in header: skip (don't add to any section)
      if (looksLikeContact(line)) continue;
    }

    // ── Assign to current section ────────────────────────────────────────
    if (currentSection) {
      buckets[currentSection].push(line);
      continue;
    }

    // ── Pre-section heuristic routing (no section heading seen yet) ──────
    if (!currentSection) {
      if (looksLikeContact(line)) continue; // skip contact lines

      // Skill-like lines: comma/slash-separated short tokens or known tech terms
      if (
        /excel|power\s*bi|sql|python|react|javascript|java|oracle|aws|azure|docker|git|إكسل|باور بي آي|تحليل|شبكات|برمجة/i.test(line) ||
        (line.includes(",") && line.split(",").every((t) => t.trim().length < 30))
      ) {
        buckets.skills.push(line);
        continue;
      }

      // Education-like lines
      if (
        /bachelor|master|diploma|phd|university|college|degree|graduated|بكالوريوس|ماجستير|دبلوم|جامعة|كلية|تخرج/i.test(
          line
        )
      ) {
        buckets.education.push(line);
        continue;
      }

      // Everything else before a section heading → treat as summary
      if (!buckets.summary.length || buckets.summary.join(" ").length < 800) {
        buckets.summary.push(line);
      }
    }
  }

  // ── 7. Post-process each bucket ───────────────────────────────────────────

  function joinSection(lines: string[]): string | null {
    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return text.length > 0 ? text : null;
  }

  const summaryRaw = joinSection(buckets.summary);
  const experienceRaw = joinSection(buckets.experience);
  const educationRaw = joinSection(buckets.education);
  const certificationsRaw = joinSection(buckets.certifications);

  // Skills and certifications: deduplicate bullets
  const skillsRaw = buckets.skills.length > 0 ? normalizeBullets(buckets.skills.join("\n")) || null : null;

  // ── 8. Return structured output ───────────────────────────────────────────
  return {
    name: name ?? null,
    job_title: job_title ?? null,
    summary: summaryRaw,
    skills: skillsRaw,
    experience: experienceRaw,
    education: educationRaw,
    certifications: certificationsRaw,
    raw_text,
  };
}

// ─── Text preparation for AI prompt ──────────────────────────────────────────
//
// Builds the final string that gets embedded in the AI prompt.
// Prefers the structured sections (cleaner, labelled) then falls back
// to raw_text so nothing is ever lost.

export function prepareTextForPrompt(normalized: NormalizedResumeInput): string {
  const parts: string[] = [];

  if (normalized.name) parts.push(`NAME: ${normalized.name}`);
  if (normalized.job_title) parts.push(`CURRENT/TARGET TITLE: ${normalized.job_title}`);

  if (normalized.summary) {
    parts.push(`\n── SUMMARY ──\n${normalized.summary}`);
  }

  if (normalized.experience) {
    parts.push(`\n── EXPERIENCE ──\n${normalized.experience}`);
  }

  if (normalized.skills) {
    parts.push(`\n── SKILLS ──\n${normalized.skills}`);
  }

  if (normalized.education) {
    parts.push(`\n── EDUCATION ──\n${normalized.education}`);
  }

  if (normalized.certifications) {
    parts.push(`\n── CERTIFICATIONS ──\n${normalized.certifications}`);
  }

  // If structured parsing produced a meaningful result, use it.
  // Otherwise, fall back to the cleaned raw_text — no data is lost.
  const structured = parts.join("\n").trim();
  if (structured.length > 100) return structured;

  // Fallback: return cleaned raw_text
  return normalized.raw_text;
}
