/**
 * TALENTRY — Deterministic Resume Normalizer (Deno-compatible)
 * -----------------------------------------------------------------------------
 * Focus: robust extraction + normalization before ATS scoring / AI analysis.
 * No external dependencies. No AI calls.
 */

export interface NormalizedResumeInput {
  name: string | null;
  job_title: string | null;
  summary: string | null;
  skills: string[];
  experience: string[];
  education: string[] | null;
  certifications: string[] | null;
  raw_text: string;
}

type SectionKey = "summary" | "experience" | "skills" | "education" | "certifications";

type ResumeBuckets = Record<SectionKey, string[]>;

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
      /^professional\s+profile$/i,
      /^personal\s+statement$/i,
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
      /^employment\s+record$/i,
      /^الخبرات?$/i,
      /^الخبرات?\s+العملية$/i,
      /^السجل\s+الوظيفي$/i,
      /^الخبرة\s+المهنية$/i,
      /^الخبرة$/i,
    ],
  },
  {
    key: "skills",
    patterns: [
      /^skills$/i,
      /^technical\s+skills$/i,
      /^key\s+skills$/i,
      /^core\s+skills$/i,
      /^core\s+competencies$/i,
      /^competencies$/i,
      /^tools?$/i,
      /^technologies$/i,
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
      /^academic$/i,
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
      /^professional\s+certifications?$/i,
      /^الشهادات?$/i,
      /^الشهادات?\s+المهنية$/i,
      /^الدورات?$/i,
      /^الدورات?\s+التدريبية$/i,
      /^الرخص$/i,
      /^الاعتمادات$/i,
    ],
  },
];

const NOISE_PATTERNS: RegExp[] = [
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^صفحة\s+\d+$/i,
  /^\d+\s*\/\s*\d+$/,
  /^curriculum\s+vitae$/i,
  /^resume$/i,
  /^\s*cv\s*$/i,
  /^-{3,}$/,
  /^={3,}$/,
  /^_{3,}$/,
  /^\*{3,}$/,
  /^updated\s+on\s+/i,
  /^references?\s+available\s+upon\s+request$/i,
];

const KNOWN_SKILL_KEYWORDS = [
  "excel", "power bi", "sql", "oracle", "sap", "erp", "python", "java", "javascript", "typescript",
  "react", "node", "aws", "azure", "docker", "kubernetes", "linux", "git", "jira", "tableau",
  "photoshop", "autocad", "revit", "fortigate", "cisco", "juniper", "mpls", "bgp", "ospf", "vpn",
  "hris", "recruitment", "saudization", "nitaqat", "payroll", "procurement", "logistics", "salesforce",
  "communication", "leadership", "analysis", "problem solving", "customer service", "project management",
  "microsoft office", "word", "powerpoint", "teamwork",
  "إكسل", "اكسل", "باور بي آي", "باوربوينت", "وورد", "أوراكل", "اوراكل", "ساس", "جافا", "بايثون",
  "ريأكت", "أدوبي", "فوتوشوب", "شبكات", "تحليل البيانات", "تحليل", "إدارة المشاريع", "القيادة",
  "التواصل", "حل المشكلات", "خدمة العملاء", "التوظيف", "الموارد البشرية", "السعودة", "المشتريات",
  "اللوجستيات", "المحاسبة", "إدارة الوقت"
] as const;

const JOB_TITLE_HINTS = /engineer|manager|specialist|supervisor|analyst|developer|consultant|officer|lead|director|coordinator|assistant|administrator|architect|designer|executive|technician|support|network|hr|recruiter|accountant|sales|marketing|teacher|trainer|project|procurement|logistics|operations|civil|electrical|mechanical|software|data|مهندس|مدير|أخصائي|مشرف|محلل|مطور|استشاري|فني|منسق|مساعد|مسؤول|مصمم|تنفيذي|محاسب|مسوق|مدرب|معلم|موارد\s+بشرية|مشتريات|لوجستيات|عمليات/i;
const YEAR_RANGE_RX = /(19|20)\d{2}\s*(?:[-–—/]\s*((19|20)\d{2}|present|current|now|حتى\s*الآن|الآن|present))?/i;

function stripInvisible(text: string): string {
  return text
    .replace(/\x00/g, "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ");
}

function collapseSpaces(line: string): string {
  return line.replace(/[ ]+/g, " ").trim();
}

function normalizeHeadingText(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^[•▪◦*\-]+\s*/, "")
    .replace(/[|]+/g, " ")
    .replace(/[\s:：\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLineText(line: string): string {
  return collapseSpaces(
    stripInvisible(line)
      .replace(/[•▪◦]+/g, "•")
      .replace(/\s*\|\s*/g, " | ")
      .replace(/\s*([,;:])\s*/g, "$1 ")
      .replace(/\s+/g, " ")
  );
}

function normalizeBulletPrefix(line: string): string {
  return line
    .replace(/^[•▪◦*\-]+\s*/, "")
    .replace(/^\d+[.)-]\s*/, "")
    .trim();
}

function detectSection(line: string): SectionKey | null {
  const normalized = normalizeHeadingText(line);
  if (!normalized || normalized.length > 60) return null;
  for (const item of SECTION_PATTERNS) {
    if (item.patterns.some((rx) => rx.test(normalized))) return item.key;
  }
  return null;
}

function looksLikeContact(line: string): boolean {
  return (
    /@/.test(line) ||
    /\+?\d[\d\s\-()]{6,}/.test(line) ||
    /linkedin|github|portfolio/i.test(line) ||
    /^(phone|email|mobile|tel|address|contact|الهاتف|الجوال|البريد|العنوان|التواصل)\s*:/i.test(line)
  );
}

function looksLikeName(line: string): boolean {
  if (!line || line.length > 60) return false;
  if (looksLikeContact(line) || detectSection(line)) return false;
  if (/\d/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return /^[A-Za-z\u0600-\u06FF\s.'\-]+$/.test(line);
}

function looksLikeJobTitle(line: string): boolean {
  if (!line || line.length > 90) return false;
  if (looksLikeContact(line) || detectSection(line)) return false;
  return JOB_TITLE_HINTS.test(line);
}

function looksLikeEducationLine(line: string): boolean {
  return /bachelor|master|diploma|phd|degree|university|college|school|graduated|gpa|بكالوريوس|ماجستير|دبلوم|دكتوراه|جامعة|كلية|معدل|تخرج/i.test(line);
}

function looksLikeCertificationLine(line: string): boolean {
  return /certified|certification|certificate|license|training|course|pmp|ccna|ccnp|jncis|jncia|aws\s+certified|شهادة|شهادات|دورة|دورات|اعتماد/i.test(line);
}

function looksLikeSkillLine(line: string): boolean {
  if (!line || line.length > 180) return false;
  const lower = line.toLowerCase();
  if (KNOWN_SKILL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return true;

  const tokenized = line
    .split(/[،,\/|•·]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokenized.length >= 3 && tokenized.every((token) => token.length <= 40 && !YEAR_RANGE_RX.test(token))) {
    return true;
  }

  const words = line.split(/\s+/).filter(Boolean).length;
  return /^[A-Za-z\u0600-\u06FF+#.&()\-\s]{2,80}$/.test(line) && words <= 8 && /[A-Za-z\u0600-\u06FF]/.test(line);
}

function looksLikeExperienceLine(line: string): boolean {
  return YEAR_RANGE_RX.test(line) || looksLikeJobTitle(line) || /company|group|corp|inc|llc|ltd|est\.|شركة|مؤسسة|مجموعة/i.test(line);
}

function uniqueNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = normalizeBulletPrefix(item).replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function mergeWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (!out.length) {
      out.push(line);
      continue;
    }

    const prev = out[out.length - 1];
    const prevIsSection = !!detectSection(prev);
    const currentIsSection = !!detectSection(line);
    const prevStartsExperience = looksLikeExperienceLine(prev);
    const currentStartsExperience = looksLikeExperienceLine(line);

    const startsNewItem =
      currentIsSection ||
      prevIsSection ||
      /^[•▪◦*\-]/.test(line) ||
      looksLikeContact(line) ||
      looksLikeName(line) ||
      currentStartsExperience ||
      (YEAR_RANGE_RX.test(line) && prev.length > 20) ||
      (/^[A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s&/\-]{1,60}$/.test(line) && looksLikeJobTitle(line));

    const prevEndsSoft = /[,;:()\-–—/]$/.test(prev) || (prev.length < 45 && !prevStartsExperience && !prevIsSection);
    const currentLooksContinuation = /^[a-z\u0600-\u06FF(]/.test(line) || (line.length < 80 && !currentStartsExperience);

    if (prevEndsSoft && currentLooksContinuation && !startsNewItem) {
      out[out.length - 1] = `${prev} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      out.push(line);
    }
  }
  return out;
}

function extractName(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    if (looksLikeName(line)) return line;
  }
  return null;
}

function extractJobTitle(lines: string[]): string | null {
  for (const line of lines.slice(0, 12)) {
    if (looksLikeJobTitle(line)) return line;
  }
  return null;
}

function splitListLikeText(line: string): string[] {
  const normalized = normalizeBulletPrefix(line)
    .replace(/\s+[-–—]\s+/g, ", ")
    .replace(/\s+[|]\s+/g, ", ")
    .replace(/\s+[•·]\s+/g, ", ");

  const parts = normalized
    .split(/[،,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [normalized.trim()].filter(Boolean);
  return parts.filter((item) => item.length > 1 && item.length <= 60);
}

function extractKeywords(rawText: string): string[] {
  const results: string[] = [];
  const lines = rawText.split(/\n+/).map((line) => cleanLineText(line)).filter(Boolean);

  for (const line of lines) {
    if (looksLikeContact(line) || looksLikeEducationLine(line) || looksLikeName(line) || detectSection(line)) continue;

    if (looksLikeSkillLine(line)) {
      const parts = splitListLikeText(line);
      for (const part of parts) {
        if (!YEAR_RANGE_RX.test(part) && !looksLikeContact(part) && !looksLikeName(part) && part.length > 1 && part.length <= 60) {
          results.push(part);
        }
      }
    }
  }

  const keywordHits = KNOWN_SKILL_KEYWORDS.filter((kw) => rawText.toLowerCase().includes(kw.toLowerCase()));
  results.push(...keywordHits);

  return uniqueNormalized(results)
    .filter((item) => item.length > 1 && item.length <= 60)
    .slice(0, 24);
}

function extractExperienceBlocks(rawText: string): string[] {
  const lines = rawText.split(/\n+/).map((line) => cleanLineText(line)).filter(Boolean);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
    current = [];
  };

  for (const line of lines) {
    if (looksLikeContact(line) || looksLikeEducationLine(line) || looksLikeCertificationLine(line)) {
      if (current.length >= 2) flush();
      continue;
    }

    const startsExperienceBlock = YEAR_RANGE_RX.test(line) || looksLikeJobTitle(line) || /present|current|company|شركة|مؤسسة|group|corp/i.test(line);
    const actionBullet = /^[•▪◦*\-]/.test(line) || /^(managed|led|developed|implemented|supported|responsible|oversaw|achieved|created|handled|coordinated|supervised|maintained|developed|عملت|أدرت|قدت|نفذت|طورت|دعمت|أشرفت|تابعت)/i.test(line);

    if (startsExperienceBlock && current.length >= 2 && !actionBullet) {
      flush();
    }

    if (startsExperienceBlock || current.length > 0 || actionBullet) {
      current.push(line);
    }
  }
  flush();

  return uniqueNormalized(blocks).slice(0, 12);
}

function linesToSummary(lines: string[]): string | null {
  const joined = lines
    .map((line) => normalizeBulletPrefix(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return joined || null;
}

function buildCleanRawText(rawText: string): string {
  const cleaned = stripInvisible(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([•|_])\s*\1(\s*\1)*/g, "$1")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const rawLines = cleaned
    .split("\n")
    .map((line) => cleanLineText(line))
    .filter((line) => {
      if (!line) return false;
      if (NOISE_PATTERNS.some((rx) => rx.test(line))) return false;
      if (/^[^\w\u0600-\u06FF]+$/.test(line) && line.length < 4) return false;
      return true;
    });

  return mergeWrappedLines(rawLines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function bucketLines(rawText: string): ResumeBuckets {
  const buckets: ResumeBuckets = {
    summary: [],
    experience: [],
    skills: [],
    education: [],
    certifications: [],
  };

  const lines = rawText.split("\n").map((line) => cleanLineText(line)).filter(Boolean);
  let currentSection: SectionKey | null = null;
  let lineIndex = 0;

  for (const line of lines) {
    lineIndex += 1;
    const inHeaderZone = lineIndex <= 8;
    const section = detectSection(line);
    if (section) {
      currentSection = section;
      continue;
    }

    if (currentSection) {
      buckets[currentSection].push(line);
      continue;
    }

    if (looksLikeContact(line)) continue;
    if (inHeaderZone && (looksLikeName(line) || looksLikeJobTitle(line))) continue;
    if (looksLikeEducationLine(line)) {
      buckets.education.push(line);
      continue;
    }
    if (looksLikeCertificationLine(line)) {
      buckets.certifications.push(line);
      continue;
    }
    if (looksLikeExperienceLine(line)) {
      buckets.experience.push(line);
      continue;
    }
    if (looksLikeSkillLine(line)) {
      buckets.skills.push(line);
      continue;
    }

    if (buckets.summary.join(" ").length < 1000) {
      buckets.summary.push(line);
    }
  }

  return buckets;
}

function normalizeSkills(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    out.push(...splitListLikeText(line));
  }
  return uniqueNormalized(out).slice(0, 24);
}

function normalizeExperience(lines: string[]): string[] {
  const out: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const block = buffer.join("\n").trim();
    if (block) out.push(block);
    buffer = [];
  };

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    const newBlock = YEAR_RANGE_RX.test(clean) || (looksLikeJobTitle(clean) && buffer.length >= 1 && !/^[•▪◦*\-]/.test(clean));
    if (newBlock && buffer.length >= 2) flush();
    buffer.push(clean);
  }
  flush();

  return uniqueNormalized(out).slice(0, 12);
}

function normalizeSimpleList(lines: string[]): string[] | null {
  const cleaned = uniqueNormalized(lines).slice(0, 12);
  return cleaned.length ? cleaned : null;
}

export function normalizeResumeText(rawText: string): NormalizedResumeInput {
  if (!rawText || !rawText.trim()) {
    return {
      name: null,
      job_title: null,
      summary: null,
      skills: [],
      experience: [],
      education: null,
      certifications: null,
      raw_text: "",
    };
  }

  const cleanedRawText = buildCleanRawText(rawText);
  const lines = cleanedRawText.split("\n").filter(Boolean);
  const buckets = bucketLines(cleanedRawText);

  let skills = normalizeSkills(buckets.skills);
  let experience = normalizeExperience(buckets.experience);
  const summary = linesToSummary(buckets.summary);
  const education = normalizeSimpleList(buckets.education);
  const certifications = normalizeSimpleList(buckets.certifications);

  // Mandatory fallback: never allow empty arrays when text exists.
  if (skills.length === 0 || experience.length === 0) {
    const fallbackSkills = extractKeywords(cleanedRawText);
    const fallbackExperience = extractExperienceBlocks(cleanedRawText);

    if (skills.length === 0) skills = fallbackSkills;
    if (experience.length === 0) experience = fallbackExperience;
  }

  // Minimum structure guard.
  if (cleanedRawText.length > 0) {
    if (skills.length < 3) {
      const strengthened = extractKeywords(cleanedRawText);
      skills = uniqueNormalized([...skills, ...strengthened]).slice(0, 24);
    }

    if (experience.length < 1) {
      experience = extractExperienceBlocks(cleanedRawText);
    }
  }

  return {
    name: extractName(lines),
    job_title: extractJobTitle(lines),
    summary,
    skills,
    experience,
    education,
    certifications,
    raw_text: cleanedRawText,
  };
}

export function prepareTextForPrompt(normalized: NormalizedResumeInput): string {
  const parts: string[] = [];

  if (normalized.name) parts.push(`NAME: ${normalized.name}`);
  if (normalized.job_title) parts.push(`CURRENT/TARGET TITLE: ${normalized.job_title}`);

  const structuredWeak = normalized.skills.length < 3 || normalized.experience.length < 1;
  if (structuredWeak) {
    parts.push("NOTE: The resume is unstructured. Extract missing sections before analysis.");
  }

  if (normalized.summary) {
    parts.push(`\n── SUMMARY ──\n${normalized.summary}`);
  }

  if (normalized.experience.length) {
    parts.push(`\n── EXPERIENCE ──\n${normalized.experience.join("\n\n")}`);
  }

  if (normalized.skills.length) {
    parts.push(`\n── SKILLS ──\n${normalized.skills.join("\n")}`);
  }

  if (normalized.education?.length) {
    parts.push(`\n── EDUCATION ──\n${normalized.education.join("\n")}`);
  }

  if (normalized.certifications?.length) {
    parts.push(`\n── CERTIFICATIONS ──\n${normalized.certifications.join("\n")}`);
  }

  parts.push(`\n── CLEANED RAW TEXT ──\n${normalized.raw_text}`);

  return parts.join("\n").trim();
}

export { extractKeywords, extractExperienceBlocks };
