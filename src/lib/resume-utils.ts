/**
 * Shared resume utilities for text cleaning, section detection,
 * structured data mapping, and HTML conversion.
 *
 * Used by: ResumeEnhancement, Builder, Analysis pages and components.
 */

// ── Types ───────────────────────────────────────────────────────
export interface StructuredResume {
  name: string;
  job_title: string;
  contact: string;
  summary: string;
  experience: string;
  skills: string;
  education: string;
  certifications: string;
  projects: string;
  languages: string;
}

export const EMPTY_STRUCTURED: StructuredResume = {
  name: "",
  job_title: "",
  contact: "",
  summary: "",
  experience: "",
  skills: "",
  education: "",
  certifications: "",
  projects: "",
  languages: "",
};

export type Rating = "good" | "improve" | "missing";

export interface AtsMetrics {
  overall: number;
  structure: Rating;
  keywords: Rating;
  readability: Rating;
  impact: Rating;
  completeness: Rating;
}

export interface Suggestion {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  field: keyof StructuredResume;
  fix: string;
  actionLabel?: string;
  actionLabelAr?: string;
}

// ── Section metadata ────────────────────────────────────────────
export const SECTION_LABELS: Record<keyof StructuredResume, { en: string; ar: string }> = {
  name: { en: "Full Name", ar: "الاسم الكامل" },
  job_title: { en: "Job Title", ar: "المسمى الوظيفي" },
  contact: { en: "Contact Information", ar: "بيانات الاتصال" },
  summary: { en: "Professional Summary", ar: "الملخص المهني" },
  experience: { en: "Work Experience", ar: "الخبرة العملية" },
  skills: { en: "Skills", ar: "المهارات" },
  education: { en: "Education", ar: "التعليم" },
  certifications: { en: "Certifications", ar: "الشهادات" },
  projects: { en: "Projects", ar: "المشاريع" },
  languages: { en: "Languages", ar: "اللغات" },
};

export const SECTION_ORDER: (keyof StructuredResume)[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
];

export const PROTECTED_FIELDS: (keyof StructuredResume)[] = ["name", "job_title", "contact"];

export const IMPROVABLE_FIELDS: (keyof StructuredResume)[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
];

// ── Section heading mapping (EN + AR) ───────────────────────────
export const COMMON_SECTION_HEADINGS: Record<string, keyof StructuredResume> = {
  // English
  "job title": "job_title",
  title: "job_title",
  position: "job_title",
  headline: "job_title",

  contact: "contact",
  "contact information": "contact",
  "contact info": "contact",
  "contact details": "contact",
  "personal information": "contact",
  "personal details": "contact",

  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  "professional profile": "summary",
  about: "summary",
  "about me": "summary",
  objective: "summary",
  "career objective": "summary",
  overview: "summary",
  "executive summary": "summary",
  "career summary": "summary",

  experience: "experience",
  "work experience": "experience",
  "employment history": "experience",
  employment: "experience",
  "professional experience": "experience",
  "career history": "experience",
  "work history": "experience",
  "relevant experience": "experience",

  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
  "key skills": "skills",
  competencies: "skills",
  "core competencies": "skills",
  "professional skills": "skills",
  "skills & competencies": "skills",
  "areas of expertise": "skills",
  "technical competencies": "skills",

  education: "education",
  "academic background": "education",
  qualifications: "education",
  "academic qualifications": "education",
  "educational background": "education",

  certifications: "certifications",
  certificates: "certifications",
  courses: "certifications",
  training: "certifications",
  licenses: "certifications",
  "professional development": "certifications",
  "training & certifications": "certifications",
  "certifications & training": "certifications",
  "professional certifications": "certifications",

  projects: "projects",
  project: "projects",
  "key projects": "projects",
  "notable projects": "projects",
  "selected projects": "projects",

  languages: "languages",
  language: "languages",
  "language skills": "languages",
  "language proficiency": "languages",

  // Arabic
  "المسمى الوظيفي": "job_title",
  الوظيفة: "job_title",
  المنصب: "job_title",

  "بيانات الاتصال": "contact",
  "معلومات الاتصال": "contact",
  "البيانات الشخصية": "contact",
  "المعلومات الشخصية": "contact",

  الملخص: "summary",
  نبذة: "summary",
  "الملخص المهني": "summary",
  "الهدف الوظيفي": "summary",
  "نبذة مهنية": "summary",
  "نبذة عني": "summary",
  "ملخص مهني": "summary",

  "الخبرة العملية": "experience",
  الخبرات: "experience",
  الخبرة: "experience",
  "الخبرات العملية": "experience",
  "الخبرة المهنية": "experience",
  "تاريخ التوظيف": "experience",
  "السجل الوظيفي": "experience",

  المهارات: "skills",
  "المهارات التقنية": "skills",
  الكفاءات: "skills",
  "المهارات المهنية": "skills",
  "المهارات الأساسية": "skills",

  التعليم: "education",
  "المؤهلات العلمية": "education",
  المؤهلات: "education",
  "الخلفية الأكاديمية": "education",
  "المؤهلات الأكاديمية": "education",

  الشهادات: "certifications",
  الدورات: "certifications",
  "الدورات التدريبية": "certifications",
  الاعتمادات: "certifications",
  "الشهادات المهنية": "certifications",
  "التطوير المهني": "certifications",

  المشاريع: "projects",
  المشروع: "projects",
  اللغات: "languages",
  اللغة: "languages",
};

// ── Robust parser metadata ──────────────────────────────────────
type SectionKey =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"
  | "projects"
  | "languages"
  | "name"
  | "job_title"
  | "contact";

const ROBUST_SECTION_PATTERNS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  {
    key: "summary",
    patterns: [
      /^professional\s+summary$/i,
      /^summary$/i,
      /^profile$/i,
      /^career\s+summary$/i,
      /^objective$/i,
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
      /^employment$/i,
      /^professional\s+experience$/i,
      /^career\s+history$/i,
      /^work\s+history$/i,
      /^الخبرات$/i,
      /^الخبرة$/i,
      /^الخبرات\s+العملية$/i,
      /^الخبرة\s+العملية$/i,
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
      /^qualifications$/i,
      /^academic\s+qualification$/i,
      /^التعليم$/i,
      /^المؤهلات$/i,
      /^المؤهلات\s+العلمية$/i,
      /^التحصيل\s+العلمي$/i,
      /^الخلفية\s+الأكاديمية$/i,
    ],
  },
  {
    key: "certifications",
    patterns: [
      /^certifications$/i,
      /^certification$/i,
      /^certificates$/i,
      /^licenses$/i,
      /^courses$/i,
      /^training$/i,
      /^الشهادات$/i,
      /^الشهادات\s+المهنية$/i,
      /^الدورات$/i,
      /^الدورات\s+التدريبية$/i,
      /^الرخص$/i,
      /^الاعتمادات$/i,
    ],
  },
  {
    key: "projects",
    patterns: [/^projects$/i, /^project$/i, /^selected\s+projects$/i, /^المشاريع$/i, /^المشروع$/i],
  },
  {
    key: "languages",
    patterns: [/^languages$/i, /^language$/i, /^linguistic\s+skills$/i, /^اللغات$/i, /^اللغة$/i],
  },
];

const NOISE_PATTERNS: RegExp[] = [
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^صفحة\s+\d+$/i,
  /^curriculum\s+vitae$/i,
  /^resume$/i,
  /^cv$/i,
];

// ── Text cleaning ───────────────────────────────────────────────
export function normalizeWhitespace(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function cleanArtifacts(text: string): string {
  return normalizeWhitespace(
    String(text || "")
      .replace(/\x00/g, "")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "")
      .replace(/\u200D/g, "")
      .replace(/\uFEFF/g, "")
      .replace(/\[Type here\]/gi, "")
      .replace(/\[Please confirm\]/gi, "")
      .replace(/\[قيمة مطلوبة\]/gi, "")
      .replace(/\bmissing_information\b/gi, "")
      .replace(/\bnull\b/gi, "")
      .replace(/\bundefined\b/gi, "")
      .replace(/\bN\/A\b/gi, "")
      .replace(/^\s*[-•▪*]+\s*$/gm, "")
      .replace(/^\s*page\s+\d+\s*$/gim, "")
      .replace(/^\s*curriculum vitae\s*$/gim, "")
      .replace(/^\s*resume\s*$/gim, "")
      .replace(/^\s*cv\s*$/gim, ""),
  );
}

/**
 * Comprehensive resume text cleaner — single entry point for the cleaning layer.
 */
export function cleanResumeText(raw: string): string {
  let text = cleanArtifacts(raw);

  // Normalize bullet characters
  text = text.replace(/^[\s]*[▪▸►◆◇‣⁃■□●○➤➜→]\s*/gm, "• ");
  text = text.replace(/^[\s]*[-–—]\s+/gm, "• ");
  text = text.replace(/^[\s]*\*\s+/gm, "• ");

  // Merge broken lines
  const lines = text.split("\n");
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      merged.push("");
      continue;
    }
    const nextLine = (lines[i + 1] || "").trim();
    const endsWithPunctuation = /[.;:!?\u061F\u060C]$/.test(line);
    const nextStartsLower = /^[a-z\u0600-\u06FF]/.test(nextLine);
    const nextIsBullet = /^[•▪*\-]/.test(nextLine);
    const lineIsHeading = COMMON_SECTION_HEADINGS[normalizeHeadingKey(line)];

    if (
      !endsWithPunctuation &&
      !nextIsBullet &&
      !lineIsHeading &&
      nextStartsLower &&
      line.length < 80 &&
      nextLine.length > 0
    ) {
      merged.push(`${line} ${nextLine}`);
      i++;
    } else {
      merged.push(line);
    }
  }
  text = merged.join("\n");

  // Remove duplicated section headings
  const finalLines = text.split("\n");
  const deduped: string[] = [];
  let prevHeadingKey = "";
  for (const line of finalLines) {
    const hk = normalizeHeadingKey(line);
    if (COMMON_SECTION_HEADINGS[hk]) {
      if (hk === prevHeadingKey) continue;
      prevHeadingKey = hk;
    } else if (line.trim()) {
      prevHeadingKey = "";
    }
    deduped.push(line);
  }

  return normalizeWhitespace(deduped.join("\n"));
}

/**
 * Parse experience text into structured bullet groups for the Builder.
 */
export interface ExperienceBullet {
  id: string;
  text: string;
}

export interface ExperienceRole {
  id: string;
  header: string;
  bullets: ExperienceBullet[];
}

export function parseExperienceIntoBullets(experienceText: string): ExperienceRole[] {
  if (!experienceText.trim()) return [];
  const groups = experienceText
    .split(/\n{2,}/)
    .map((g) => g.trim())
    .filter(Boolean);
  return groups.map((group, gIdx) => {
    const lines = group
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const header = lines[0] || "";
    const bullets = lines
      .slice(1)
      .map((line, bIdx) => ({
        id: `role-${gIdx}-bullet-${bIdx}`,
        text: normalizeBulletLine(line),
      }))
      .filter((b) => b.text);
    return { id: `role-${gIdx}`, header: cleanArtifacts(header), bullets };
  });
}

export function experienceRolesToText(roles: ExperienceRole[]): string {
  return roles
    .map((role) => {
      const bullets = role.bullets.map((b) => `• ${b.text}`).join("\n");
      return [role.header, bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function splitLines(text: string): string[] {
  return cleanArtifacts(text)
    .split("\n")
    .map((l) => cleanArtifacts(l))
    .filter(Boolean);
}

export function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = cleanArtifacts(raw);
    const key = line.toLowerCase().trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function splitSmartList(text: string): string[] {
  return uniqueLines(
    cleanArtifacts(text)
      .split(/\n|,|،|;|•|▪|\|/g)
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

export function normalizeHeadingKey(line: string): string {
  return cleanArtifacts(line)
    .toLowerCase()
    .replace(/[:_\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBulletLine(line: string): string {
  return cleanArtifacts(line)
    .replace(/^[•▪*\-\s]+/, "")
    .trim();
}

export function toBullets(lines: string[]): string[] {
  return uniqueLines(
    lines
      .map(normalizeBulletLine)
      .filter(Boolean)
      .map((x) => `• ${x}`),
  );
}

// ── Detection helpers ───────────────────────────────────────────
export function detectResumeLanguage(text: string): "ar" | "en" {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (text.match(/[A-Za-z]/g) || []).length;
  return arabicChars > englishChars ? "ar" : "en";
}

export function isLikelyEmail(line: string): boolean {
  return /[\w.+-]+@[\w-]+\.[\w.-]+/.test(line);
}

export function isLikelyPhone(line: string): boolean {
  return (
    /(\+?\d[\d\s\-()]{7,}\d)/.test(line) ||
    /(05\d{8})/.test(line) ||
    /(\+966\d{9})/.test(line) ||
    /(\+20\d{10})/.test(line) ||
    /(\+971\d{9})/.test(line)
  );
}

export function isLikelyLinkedIn(line: string): boolean {
  return /linkedin\.com|linked\s*in/i.test(line);
}

export function isLikelyWebsite(line: string): boolean {
  return /https?:\/\/|www\.|github\.com|portfolio|behance/i.test(line);
}

export function isLikelyLocation(line: string): boolean {
  return /(riyadh|jeddah|dammam|ksa|saudi|location|address|الرياض|جدة|الدمام|السعودية|العنوان|الموقع|cairo|alexandria|dubai|abu dhabi|القاهرة|الإسكندرية|دبي|أبوظبي|amman|beirut|doha|muscat|kuwait|manama|عمان|بيروت|الدوحة|مسقط|الكويت|المنامة)/i.test(
    line,
  );
}

export function isLikelyContactLine(line: string): boolean {
  return (
    isLikelyEmail(line) ||
    isLikelyPhone(line) ||
    isLikelyLinkedIn(line) ||
    isLikelyLocation(line) ||
    isLikelyWebsite(line)
  );
}

export function looksLikeDateRange(line: string): boolean {
  return /\b(19|20)\d{2}\b|present|current|till now|to date|ongoing|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|حتى الآن|حاليا|حالياً|الآن/i.test(
    line,
  );
}

export function looksLikeRoleHeader(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length > 140) return false;
  const hasDate = looksLikeDateRange(t);
  const hasSeparator = /[|–—]/.test(t) || /\t/.test(t);
  const hasRoleWords =
    /(manager|engineer|specialist|supervisor|analyst|consultant|developer|officer|lead|administrator|coordinator|trainer|director|architect|designer|accountant|teacher|nurse|doctor|technician|intern|assistant|associate|executive|representative|مدير|مهندس|أخصائي|مشرف|محلل|استشاري|مطور|مسؤول|قائد|منسق|مدرب|محاسب|معلم|ممرض|طبيب|فني|متدرب|مساعد)/i.test(
      t,
    );
  const hasCompanyWords =
    /(company|corp|inc|llc|ltd|group|hospital|ministry|university|school|agency|solutions|network|technologies|systems|consulting|services|تقنية|شركة|مؤسسة|مجموعة|مستشفى|وزارة|جامعة|معهد)/i.test(
      t,
    );

  if (hasDate && (hasRoleWords || hasCompanyWords)) return true;
  if (hasSeparator && (hasDate || hasCompanyWords || hasRoleWords)) return true;
  if (hasDate && hasSeparator && t.length < 80) return true;

  return false;
}

export function isProbablyName(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length < 3 || t.length > 60) return false;
  if (isLikelyContactLine(t)) return false;
  if (looksLikeRoleHeader(t)) return false;
  if (COMMON_SECTION_HEADINGS[normalizeHeadingKey(t)]) return false;
  const wordCount = t.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 6) return false;
  if (/\d/.test(t) && !/[\u0600-\u06FF]/.test(t)) return false;
  if (/^(i |my |the |a |an |with |from |to )/i.test(t)) return false;
  return true;
}

export function isProbablyJobTitle(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length < 3 || t.length > 80) return false;
  if (isLikelyContactLine(t)) return false;
  if (t.split(/\s+/).length > 8) return false;
  return /(manager|engineer|specialist|supervisor|analyst|consultant|developer|lead|architect|officer|designer|accountant|teacher|nurse|doctor|technician|administrator|coordinator|senior|junior|executive|intern|assistant|associate|representative|مدير|مهندس|أخصائي|مشرف|محلل|استشاري|مطور|قائد|مسؤول|محاسب|معلم|ممرض|طبيب|فني|متدرب|مساعد)/i.test(
    t,
  );
}

const INVALID_TITLE_RE =
  /\b(riyadh|jeddah|dammam|saudi arabia|ksa|location|address|email|phone|linkedin|aug|jan|feb|mar|apr|may|jun|jul|sep|oct|nov|dec|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\b/i;

export function sanitizeJobTitle(value: string): string {
  const t = cleanArtifacts(value).replace(/^[\-|•,:\s]+/, "");
  if (!t) return "";
  if (isLikelyContactLine(t)) return "";
  if (/\d/.test(t)) return "";
  if (INVALID_TITLE_RE.test(t)) return "";
  if (t.split(/\s+/).length > 8) return "";
  return isProbablyJobTitle(t) ? t : "";
}

export function sanitizePhone(value: string): string {
  const raw = cleanArtifacts(value).replace(/\++$/g, "");
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+9665\d{8}$/.test(digits)) return digits;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  return "";
}

export function sanitizeLinkedIn(value: string): string {
  const raw = cleanArtifacts(value).replace(/^linkedin\s*:?\s*/i, "");
  if (!raw) return "";
  const match = raw.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+/i);
  if (!match) return "";
  return `https://${match[0].replace(/^(https?:\/\/)?(www\.)?/i, "")}`;
}

export function sanitizeName(value: string): string {
  const t = cleanArtifacts(value);
  if (!t) return "";
  if (isLikelyContactLine(t)) return "";
  if (/\d/.test(t)) return "";
  if (COMMON_SECTION_HEADINGS[normalizeHeadingKey(t)]) return "";
  if (t.split(/\s+/).length < 2 || t.split(/\s+/).length > 6) return "";
  return t;
}

export function sanitizeLocation(value: string): string {
  const t = cleanArtifacts(value).replace(/^(location|address|الموقع|العنوان)\s*:?\s*/i, "");
  if (!t) return "";
  if (isLikelyEmail(t) || isLikelyPhone(t) || isLikelyLinkedIn(t) || isLikelyWebsite(t)) return "";
  if (t.length > 40) return "";
  return isLikelyLocation(t) ? t : "";
}

export function sanitizeContactString(contact: string): string {
  const parts = splitSmartList(contact)
    .map((part) => sanitizeEmailLike(part) || sanitizePhone(part) || sanitizeLocation(part) || sanitizeLinkedIn(part))
    .filter(Boolean);
  return uniqueLines(parts).join("\n");
}

function sanitizeEmailLike(value: string): string {
  return cleanArtifacts(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

export function sanitizeStructuredResume(input: StructuredResume): StructuredResume {
  return enrichStructuredResume({
    ...input,
    name: sanitizeName(input.name),
    job_title: sanitizeJobTitle(input.job_title),
    contact: sanitizeContactString(input.contact),
  });
}

// ── Section validation ──────────────────────────────────────────
function lineMatchesSection(line: string, section: keyof StructuredResume): boolean {
  const t = cleanArtifacts(line).toLowerCase();
  if (!t) return true;

  if (isLikelyContactLine(line)) return section === "contact";

  if (section === "skills") {
    if (/\b(bachelor|master|diploma|phd|degree|university|college|بكالوريوس|ماجستير|دبلوم|جامعة|كلية)\b/i.test(t))
      return false;
    if (looksLikeRoleHeader(line)) return false;
  }

  if (section === "education") {
    if (
      t.length < 30 &&
      !looksLikeDateRange(line) &&
      !/(bachelor|master|diploma|phd|degree|university|college|بكالوريوس|ماجستير|دبلوم|جامعة|كلية)/i.test(t)
    ) {
      if (
        /(excel|power bi|sql|python|react|javascript|java|oracle|aws|network|communication|leadership|إكسل|برمجة)/i.test(
          t,
        )
      )
        return false;
    }
  }

  if (section === "skills" || section === "education" || section === "certifications") {
    if (looksLikeRoleHeader(line)) return false;
  }

  if (section === "summary") {
    if (/^[•▪*\-]/.test(t) && t.length < 40) return false;
  }

  return true;
}

// ── Robust parser helpers ───────────────────────────────────────
function normalizeRobustLine(line: string): string {
  return cleanArtifacts(
    line
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*•\s*/g, "• ")
      .replace(/\s*-\s*/g, " - ")
      .trim(),
  );
}

function isNoise(line: string): boolean {
  const v = normalizeRobustLine(line);
  if (!v) return true;
  return NOISE_PATTERNS.some((rx) => rx.test(v));
}

function normalizeHeadingText(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/[:：\-–—]+$/, "")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSectionHeading(line: string): SectionKey | null {
  const normalized = normalizeHeadingText(line);
  if (!normalized) return null;

  for (const item of ROBUST_SECTION_PATTERNS) {
    if (item.patterns.some((rx) => rx.test(normalized))) {
      return item.key;
    }
  }

  const mapped = COMMON_SECTION_HEADINGS[normalizeHeadingKey(normalized)];
  return (mapped as SectionKey) || null;
}

function splitRawText(raw: string): string[] {
  return cleanResumeText(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeRobustLine)
    .filter((line) => !isNoise(line));
}

function looksLikeContactLoose(line: string): boolean {
  return (
    /@/.test(line) ||
    /\+?\d[\d\s\-()]{6,}/.test(line) ||
    /linkedin|github|portfolio|riyadh|jeddah|saudi arabia|ksa|السعودية|الرياض|جدة/i.test(line)
  );
}

function looksLikeNameLoose(line: string): boolean {
  if (!line) return false;
  if (line.length > 60) return false;
  if (looksLikeContactLoose(line)) return false;
  if (detectSectionHeading(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  return /^[A-Za-z\u0600-\u06FF\s.'-]+$/.test(line);
}

function looksLikeJobTitleLoose(line: string): boolean {
  if (!line) return false;
  if (line.length > 80) return false;
  if (looksLikeContactLoose(line)) return false;
  if (detectSectionHeading(line)) return false;

  return /engineer|manager|specialist|supervisor|analyst|developer|consultant|officer|lead|director|support|technician|coordinator|assistant|مهندس|مدير|أخصائي|مشرف|محلل|مطور|استشاري|فني|منسق|مساعد/i.test(
    line,
  );
}

function mergeWrappedLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (const line of lines) {
    if (!merged.length) {
      merged.push(line);
      continue;
    }

    const prev = merged[merged.length - 1];
    const currentIsHeading = !!detectSectionHeading(line);
    const prevEndsSoftly = /[,;/:\-–—]$/.test(prev) || prev.length < 55;
    const currentLooksContinuation =
      !/^[•▪◦*-]/.test(line) &&
      !looksLikeContactLoose(line) &&
      !looksLikeNameLoose(line) &&
      !looksLikeJobTitleLoose(line) &&
      !currentIsHeading;

    if (prevEndsSoftly && currentLooksContinuation) {
      merged[merged.length - 1] = `${prev} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      merged.push(line);
    }
  }

  return merged;
}

function appendSectionValue(target: StructuredResume, key: SectionKey, value: string) {
  const clean = cleanArtifacts(value).trim();
  if (!clean) return;

  if (key === "name" || key === "job_title" || key === "contact") {
    target[key] = target[key] ? `${target[key]}\n${clean}` : clean;
    return;
  }

  const current = cleanArtifacts(target[key] || "").trim();
  target[key] = current ? `${current}\n${clean}` : clean;
}

function inferHeader(lines: string[], target: StructuredResume) {
  const top = lines.slice(0, 8);

  for (const line of top) {
    if (!target.name && looksLikeNameLoose(line)) {
      target.name = line;
      continue;
    }

    if (!target.job_title && looksLikeJobTitleLoose(line)) {
      target.job_title = line;
      continue;
    }

    if (looksLikeContactLoose(line)) {
      target.contact = target.contact ? `${target.contact}\n${line}` : line;
    }
  }
}

function normalizeBullets(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => cleanArtifacts(line))
    .filter(Boolean);

  return lines
    .map((line) => {
      if (detectSectionHeading(line)) return line;
      if (looksLikeNameLoose(line) || looksLikeJobTitleLoose(line) || looksLikeContactLoose(line)) return line;
      if (/^[•▪◦*-]\s*/.test(line)) return `• ${normalizeBulletLine(line)}`;
      if (/^\d{4}/.test(line)) return `• ${line}`;
      if (line.length > 120) return line;
      return `• ${line}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanupSectionText(key: SectionKey, value: string): string {
  let text = cleanArtifacts(value).trim();
  if (!text) return "";

  if (key === "contact") {
    return sanitizeContactString(text);
  }

  if (key === "name") {
    return sanitizeName(text);
  }

  if (key === "job_title") {
    return sanitizeJobTitle(text);
  }

  if (key === "skills" || key === "certifications" || key === "projects" || key === "languages") {
    text = normalizeBullets(text);
    text = text
      .split("\n")
      .map((l) => l.replace(/^•\s*/, ""))
      .filter(Boolean)
      .join("\n");
  }

  if (key === "experience") {
    text = formatExperienceText(text);
  }

  if (key === "education") {
    text = formatEducationText(text);
  }

  if (key === "summary") {
    text = formatSummaryText(text);
  }

  return text;
}

function parseResumeTextRobust(rawText: string): StructuredResume {
  const result: StructuredResume = { ...EMPTY_STRUCTURED };

  if (!rawText?.trim()) return result;

  const lines = mergeWrappedLines(splitRawText(rawText));
  inferHeader(lines, result);

  let currentSection: SectionKey | null = null;

  for (const line of lines) {
    const heading = detectSectionHeading(line);

    if (heading) {
      currentSection = heading;
      continue;
    }

    if (!result.contact && looksLikeContactLoose(line)) {
      appendSectionValue(result, "contact", line);
      continue;
    }

    if (!result.name && looksLikeNameLoose(line)) {
      appendSectionValue(result, "name", line);
      continue;
    }

    if (!result.job_title && looksLikeJobTitleLoose(line)) {
      appendSectionValue(result, "job_title", line);
      continue;
    }

    if (currentSection) {
      appendSectionValue(result, currentSection, line);
      continue;
    }

    if (!result.summary) {
      appendSectionValue(result, "summary", line);
      continue;
    }

    if (looksLikeRoleHeader(line)) {
      appendSectionValue(result, "experience", line);
      continue;
    }

    if (/(excel|power bi|sql|python|react|javascript|java|oracle|aws|azure|network|communication|leadership|problem solving|docker|kubernetes|git|agile|scrum|إكسل|باور بي آي|تحليل|إدارة|قيادة|شبكات|برمجة)/i.test(line)) {
      appendSectionValue(result, "skills", line);
      continue;
    }

    if (/(arabic|english|urdu|french|hindi|spanish|german|chinese|mandarin|العربية|الانجليزية|الإنجليزية|فرنسي|أردو|هندي)/i.test(line)) {
      appendSectionValue(result, "languages", line);
      continue;
    }

    if (/(Bachelor|Master|Diploma|PhD|University|College|degree|graduated|بكالوريوس|ماجستير|دبلوم|جامعة|كلية|تخرج)/i.test(line)) {
      appendSectionValue(result, "education", line);
    }
  }

  (Object.keys(result) as SectionKey[]).forEach((key) => {
    result[key] = cleanupSectionText(key, result[key] || "");
  });

  return result;
}

// ── Formatting helpers ──────────────────────────────────────────
export function formatSummaryText(raw: string): string {
  const text = cleanArtifacts(raw);
  if (!text) return "";
  return splitLines(text).join("\n");
}

export function formatSkillsText(raw: string): string {
  return uniqueLines(splitSmartList(raw)).join("\n");
}

export function formatLanguagesText(raw: string): string {
  return uniqueLines(splitSmartList(raw)).join("\n");
}

export function formatCertificationsText(raw: string): string {
  return uniqueLines(
    cleanArtifacts(raw)
      .split(/\n|•|▪|,/)
      .map((x) => x.trim())
      .filter(Boolean),
  ).join("\n");
}

export function formatProjectsText(raw: string): string {
  return uniqueLines(splitLines(raw)).join("\n");
}

export function formatEducationText(raw: string): string {
  const lines = splitLines(raw);
  if (!lines.length) return "";
  const groups: string[] = [];
  let current = "";
  for (const line of lines) {
    if (isLikelyContactLine(line)) continue;

    const headerLike =
      looksLikeDateRange(line) ||
      /\b(Bachelor|Master|Diploma|PhD|degree|University|College|بكالوريوس|ماجستير|دبلوم|جامعة|كلية)\b/i.test(line);
    if (!current) {
      current = line;
      continue;
    }
    if (headerLike && current.length > 0 && groups.length < 20) {
      groups.push(current.trim());
      current = line;
    } else {
      current += ` | ${line}`;
    }
  }
  if (current.trim()) groups.push(current.trim());
  return uniqueLines(groups).join("\n");
}

export function formatExperienceText(raw: string): string {
  const lines = splitLines(raw);
  if (!lines.length) return "";
  const groups: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) {
      groups.push([...current]);
      current = [];
    }
  };

  for (const line of lines) {
    if (isLikelyContactLine(line) && !looksLikeRoleHeader(line)) continue;

    const headerLike = looksLikeRoleHeader(line);
    const bulletLike = /^[•▪*\-]/.test(line);

    if (headerLike) {
      flush();
      current.push(cleanArtifacts(line));
      continue;
    }

    if (current.length === 1 && looksLikeDateRange(line) && !bulletLike && line.length < 50) {
      current[0] = `${current[0]} | ${cleanArtifacts(line)}`;
      continue;
    }

    if (current.length === 1 && !bulletLike && !looksLikeDateRange(line) && line.length < 60 && line.length > 2) {
      if (isProbablyJobTitle(current[0])) {
        current[0] = `${current[0]} | ${cleanArtifacts(line)}`;
        continue;
      }
    }

    if (!current.length) {
      if (bulletLike) {
        current.push("General Experience");
        current.push(`• ${normalizeBulletLine(line)}`);
      } else if (line.length > 60) {
        current.push("General Experience");
        current.push(`• ${normalizeBulletLine(line)}`);
      } else {
        current.push(cleanArtifacts(line));
      }
      continue;
    }
    current.push(`• ${normalizeBulletLine(line)}`);
  }
  flush();
  return groups
    .map((group) => {
      const header = cleanArtifacts(group[0] || "");
      const bullets = toBullets(group.slice(1));
      return [header, ...bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

// ── Enrichment / normalization ──────────────────────────────────
export function inferMissingSummary(data: StructuredResume): string {
  if (data.summary.trim()) return data.summary;
  const skills = splitLines(data.skills).slice(0, 6);
  const firstHeader = data.experience.split(/\n{2,}/)[0]?.split("\n")[0] || "";
  const lang = detectResumeLanguage(`${data.experience}\n${data.skills}`);
  if (lang === "ar") {
    const parts: string[] = [];
    if (data.job_title) parts.push(`متخصص في ${data.job_title}`);
    if (firstHeader) parts.push(`يمتلك خبرة عملية في ${firstHeader}`);
    if (skills.length) parts.push(`وتشمل المهارات الأساسية: ${skills.join("، ")}`);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (data.job_title) parts.push(`${data.job_title} professional`);
  if (firstHeader) parts.push(`with hands-on experience in ${firstHeader}`);
  if (skills.length) parts.push(`Skilled in ${skills.join(", ")}`);
  return parts.join(". ");
}

export function enrichStructuredResume(input: StructuredResume): StructuredResume {
  const normalized: StructuredResume = {
    name: cleanArtifacts(input.name),
    job_title: cleanArtifacts(input.job_title),
    contact: uniqueLines(splitLines(input.contact)).join("\n"),
    summary: formatSummaryText(input.summary),
    experience: formatExperienceText(input.experience),
    skills: formatSkillsText(input.skills),
    education: formatEducationText(input.education),
    certifications: formatCertificationsText(input.certifications),
    projects: formatProjectsText(input.projects),
    languages: formatLanguagesText(input.languages),
  };

  if (!normalized.summary) normalized.summary = inferMissingSummary(normalized);

  if (!normalized.job_title) {
    const firstExpHeader = normalized.experience.split(/\n/).find((l) => looksLikeRoleHeader(l)) || "";
    if (firstExpHeader) {
      const parts = firstExpHeader.split(/[|–—]/);
      normalized.job_title = cleanArtifacts(parts[0] || firstExpHeader);
    }
  }

  if (normalized.skills && normalized.education) {
    const eduLines = new Set(splitLines(normalized.education).map((l) => l.toLowerCase().trim()));
    const filteredSkills = splitLines(normalized.skills).filter((l) => !eduLines.has(l.toLowerCase().trim()));
    normalized.skills = uniqueLines(filteredSkills).join("\n");
  }

  return normalized;
}

// ── Normalize list fields from various formats ──────────────────
export function normalizeListField(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => {
      if (typeof item === "string") return splitSmartList(item);
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        return Object.values(obj)
          .map((v) => cleanArtifacts(String(v || "")))
          .filter(Boolean);
      }
      return [];
    });
    return uniqueLines(items).join("\n");
  }
  return splitSmartList(String(value || "")).join("\n");
}

// ── Map extracted data (from edge function) to editor format ────
export function mapExtractedToEditor(extracted: Record<string, unknown>): StructuredResume {
  const name = sanitizeName(String(extracted.full_name || extracted.name || extracted.candidate_name || ""));
  const jobTitle = sanitizeJobTitle(String(extracted.job_title || extracted.title || ""));

  let contact = "";
  const ci = extracted.contact_info || extracted.contact_information || extracted.contact;
  if (ci && typeof ci === "object" && !Array.isArray(ci)) {
    const cObj = ci as Record<string, unknown>;
    const pieces = [
      sanitizeEmailLike(String(cObj.email || "")),
      sanitizePhone(String(cObj.phone || cObj.mobile || "")),
      sanitizeLocation(String(cObj.location || cObj.address || "")),
      sanitizeLinkedIn(String(cObj.linkedin || "")),
      cleanArtifacts(String(cObj.website || cObj.github || "")),
    ].filter(Boolean);
    contact = uniqueLines(pieces).join("\n");
  } else {
    contact = sanitizeContactString(String(ci || ""));
  }

  const summary = cleanArtifacts(
    String(extracted.summary || extracted.professional_summary || extracted.profile || ""),
  );

  let experience = "";
  const we = extracted.work_experience || extracted.experience || extracted.employment_history;
  if (Array.isArray(we)) {
    const blocks: string[] = [];
    for (const role of we) {
      if (typeof role !== "object" || role === null) continue;
      const r = role as Record<string, unknown>;
      const rawTitle = String(r.title || r.position || r.job_title || r.role || "");
      const title = sanitizeJobTitle(rawTitle) || cleanArtifacts(rawTitle);
      const company = cleanArtifacts(String(r.company || r.organization || r.employer || ""));
      const duration = cleanArtifacts(
        String(
          r.duration ||
            r.period ||
            r.date ||
            [r.start_date || r.startDate, r.end_date || r.endDate].filter(Boolean).join(" - "),
        ),
      );
      const descSource = r.description || r.responsibilities || r.achievements || r.details || r.bullets || "";
      const bullets = Array.isArray(descSource)
        ? toBullets(descSource.map((b) => cleanArtifacts(String(b))))
        : toBullets(splitLines(String(descSource)));
      const header = [title, company, duration].filter(Boolean).join(" | ");
      const block = [header, ...bullets].filter(Boolean).join("\n");
      if (block.trim()) blocks.push(block);
    }
    experience = blocks.join("\n\n");
  } else {
    experience = cleanArtifacts(String(we || ""));
  }

  const skills = normalizeListField(extracted.skills || extracted.key_skills || extracted.technical_skills);

  let education = "";
  const ed = extracted.education || extracted.academic_background;
  if (Array.isArray(ed)) {
    education = ed
      .map((e: unknown) => {
        if (typeof e === "object" && e !== null) {
          const eo = e as Record<string, unknown>;
          return cleanArtifacts(
            [
              String(eo.degree || ""),
              String(eo.major || eo.field || ""),
              String(eo.institution || eo.university || eo.college || eo.school || ""),
              String(eo.year || eo.graduation_year || eo.date || ""),
            ]
              .filter(Boolean)
              .join(" | "),
          );
        }
        return cleanArtifacts(String(e));
      })
      .filter(Boolean)
      .join("\n");
  } else {
    education = cleanArtifacts(String(ed || ""));
  }

  const certifications = normalizeListField(
    extracted.certifications || extracted.certificates || extracted.courses || extracted.training,
  );

  let projects = "";
  const pr = extracted.projects;
  if (Array.isArray(pr)) {
    projects = pr
      .map((p: unknown) => {
        if (typeof p === "object" && p !== null) {
          const po = p as Record<string, unknown>;
          return cleanArtifacts(
            [String(po.name || po.title || ""), String(po.description || "")].filter(Boolean).join(": "),
          );
        }
        return cleanArtifacts(String(p));
      })
      .filter(Boolean)
      .join("\n");
  } else {
    projects = cleanArtifacts(String(pr || ""));
  }

  const languages = normalizeListField(extracted.languages || extracted.language);

  const fallbackHeader = sanitizeContactString(
    [
      sanitizeEmailLike(String(extracted.email || "")),
      sanitizePhone(String(extracted.phone || "")),
      sanitizeLinkedIn(String(extracted.linkedin || "")),
      sanitizeLocation(String(extracted.location || "")),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const safeContact = contact || fallbackHeader;

  return sanitizeStructuredResume({
    name,
    job_title: jobTitle,
    contact: safeContact,
    summary,
    experience,
    skills,
    education,
    certifications,
    projects,
    languages,
  });
}

// ── Raw text parser (fallback when no structured data) ──────────
export function parseResumeTextFallback(text: string): StructuredResume {
  const robust = parseResumeTextRobust(text);
  const hasUsefulData = Object.values(robust).some((v) => cleanArtifacts(v).length > 0);
  if (hasUsefulData) return sanitizeStructuredResume(robust);

  const result = { ...EMPTY_STRUCTURED };
  if (!text) return result;

  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((l) => cleanArtifacts(l))
    .filter(Boolean)
    .filter((l) => !/^\[.*\]$/.test(l));

  if (!lines.length) return result;

  const contactParts = uniqueLines(
    [
      ...(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((m) => sanitizeEmailLike(m)),
      ...(text.match(/(?:\+966\s*5\d{8}|966\s*5\d{8}|05\d{8}|5\d{8})/g) || []).map((m) => sanitizePhone(m)),
      ...(text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+/gi) || []).map((m) =>
        sanitizeLinkedIn(m),
      ),
      ...(
        text.match(
          /(?:الرياض|جدة|الدمام|Riyadh|Jeddah|Dammam|Saudi Arabia|القاهرة|دبي|Dubai|Amman|Beirut|Doha|Muscat|Kuwait)[^,\n]*/gi,
        ) || []
      ).map((m) => sanitizeLocation(m)),
    ].filter(Boolean),
  );
  result.contact = contactParts.join("\n");
  const contactSet = new Set(contactParts.map((c) => c.toLowerCase().trim()));

  const topLines = lines.slice(0, 12);
  for (const line of topLines) {
    const hk = normalizeHeadingKey(line);
    if (COMMON_SECTION_HEADINGS[hk]) break;

    if (!result.name) {
      const maybeName = sanitizeName(line);
      if (maybeName && !contactSet.has(maybeName.toLowerCase().trim())) {
        result.name = maybeName;
        continue;
      }
    }
    if (result.name && !result.job_title) {
      const maybeTitle = sanitizeJobTitle(line);
      if (maybeTitle && !contactSet.has(maybeTitle.toLowerCase().trim())) {
        result.job_title = maybeTitle;
        continue;
      }
    }
    if (isLikelyContactLine(line)) {
      const cleaned =
        sanitizeEmailLike(line) || sanitizePhone(line) || sanitizeLinkedIn(line) || sanitizeLocation(line);
      if (cleaned && !contactSet.has(cleaned.toLowerCase().trim())) {
        result.contact += (result.contact ? "\n" : "") + cleaned;
        contactSet.add(cleaned.toLowerCase().trim());
      }
    }
  }

  const boundaries: { field: keyof StructuredResume; startIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const headingKey = normalizeHeadingKey(lines[i]);
    if (COMMON_SECTION_HEADINGS[headingKey] && lines[i].length < 80) {
      boundaries.push({ field: COMMON_SECTION_HEADINGS[headingKey], startIdx: i + 1 });
    }
  }
  boundaries.sort((a, b) => a.startIdx - b.startIdx);

  for (let i = 0; i < boundaries.length; i++) {
    const { field, startIdx } = boundaries[i];
    const endIdx = i + 1 < boundaries.length ? boundaries[i + 1].startIdx - 1 : lines.length;
    const sectionLines: string[] = [];

    for (let j = startIdx; j < endIdx; j++) {
      const line = lines[j];
      if (!line.trim()) continue;
      if (contactSet.has(line.toLowerCase().trim())) continue;
      if (isLikelyContactLine(line) && field !== "contact") continue;
      const hk = normalizeHeadingKey(line);
      if (COMMON_SECTION_HEADINGS[hk] && line.length < 80) continue;
      if (lineMatchesSection(line, field)) {
        sectionLines.push(line);
      } else if (looksLikeRoleHeader(line) && field !== "experience") {
        result.experience += (result.experience ? "\n" : "") + line;
      }
    }

    if (sectionLines.length) {
      result[field] = [result[field], sectionLines.join("\n")].filter(Boolean).join("\n");
    }
  }

  const firstBoundaryIdx = boundaries.length > 0 ? boundaries[0].startIdx - 1 : lines.length;
  for (let i = 0; i < firstBoundaryIdx; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line === result.name || line === result.job_title) continue;
    if (contactSet.has(line.toLowerCase().trim())) continue;
    if (isLikelyContactLine(line)) continue;

    const hk = normalizeHeadingKey(line);
    if (COMMON_SECTION_HEADINGS[hk]) continue;

    if (line.length > 60 && !looksLikeRoleHeader(line)) {
      result.summary += (result.summary ? "\n" : "") + line;
    } else if (looksLikeRoleHeader(line)) {
      result.experience += (result.experience ? "\n" : "") + line;
    }
  }

  if (!result.skills) {
    const candidates = uniqueLines(
      lines.filter((l) => {
        if (contactSet.has(l.toLowerCase().trim())) return false;
        if (looksLikeRoleHeader(l)) return false;
        return /(excel|power bi|sql|python|react|typescript|javascript|java|oracle|aws|azure|network|communication|leadership|problem solving|docker|kubernetes|git|agile|scrum|إكسل|باور بي آي|تحليل|إدارة|قيادة|شبكات|برمجة)/i.test(
          l,
        );
      }),
    );
    if (candidates.length) result.skills = candidates.join("\n");
  }
  if (!result.languages) {
    const candidates = uniqueLines(
      lines.filter((l) => {
        if (contactSet.has(l.toLowerCase().trim())) return false;
        return /(arabic|english|urdu|french|hindi|spanish|german|chinese|mandarin|العربية|الانجليزية|الإنجليزية|فرنسي|أردو|هندي)/i.test(
          l,
        );
      }),
    );
    if (candidates.length) result.languages = candidates.join("\n");
  }
  if (!result.education) {
    const candidates = uniqueLines(
      lines.filter((l) => {
        if (contactSet.has(l.toLowerCase().trim())) return false;
        return /(Bachelor|Master|Diploma|PhD|University|College|degree|graduated|بكالوريوس|ماجستير|دبلوم|جامعة|كلية|تخرج)/i.test(
          l,
        );
      }),
    );
    if (candidates.length) result.education = candidates.join("\n");
  }

  return sanitizeStructuredResume(result);
}

// ── ATS metrics computation (rule-based, no AI) ─────────────────
function rateScore(score: number): Rating {
  if (score >= 70) return "good";
  if (score >= 40) return "improve";
  return "missing";
}

export function computeMetrics(s: StructuredResume): AtsMetrics {
  const requiredSections: (keyof StructuredResume)[] = [
    "name",
    "job_title",
    "contact",
    "summary",
    "experience",
    "skills",
    "education",
  ];
  const optionalSections: (keyof StructuredResume)[] = ["certifications", "projects", "languages"];

  let structurePoints = 0;
  for (const k of requiredSections) {
    if (s[k].trim().length > 3) structurePoints += 10;
  }
  for (const k of optionalSections) {
    if (s[k].trim().length > 3) structurePoints += 5;
  }
  const expDates = (s.experience.match(/\b(19|20)\d{2}\b/g) || []).length;
  if (expDates >= 2) structurePoints += 5;
  structurePoints += 10;
  const structureScore = Math.min(100, structurePoints);

  const actionVerbs = [
    "led",
    "managed",
    "developed",
    "increased",
    "reduced",
    "created",
    "implemented",
    "achieved",
    "designed",
    "built",
    "optimized",
    "delivered",
    "improved",
    "launched",
    "established",
    "coordinated",
    "supervised",
    "analyzed",
    "streamlined",
    "mentored",
    "قاد",
    "أدار",
    "طور",
    "زاد",
    "أنشأ",
    "نفذ",
    "حقق",
    "صمم",
    "بنى",
    "حسن",
    "أطلق",
    "أسس",
    "نسق",
    "أشرف",
    "حلل",
  ];
  const expLower = s.experience.toLowerCase();
  const verbHits = actionVerbs.filter((v) => expLower.includes(v)).length;
  const skillItems = splitLines(s.skills).length;
  const keywordsScore = Math.min(
    100,
    verbHits * 8 + (skillItems >= 8 ? 40 : skillItems >= 5 ? 25 : skillItems > 0 ? 10 : 0),
  );

  const bullets = (s.experience.match(/(^|\n)•\s/g) || []).length;
  const expRoles = s.experience.split(/\n{2,}/).filter(Boolean).length;
  let readabilityScore = 0;
  readabilityScore += Math.min(40, bullets * 6);
  readabilityScore += s.summary.length > 80 ? 25 : s.summary.length > 40 ? 15 : 0;
  readabilityScore += expRoles >= 2 ? 15 : expRoles >= 1 ? 8 : 0;
  readabilityScore += s.education.trim() ? 10 : 0;
  readabilityScore += s.contact.trim() ? 10 : 0;
  readabilityScore = Math.min(100, readabilityScore);

  const numbers = (s.experience.match(/\d+%/g) || []).length;
  const dollarAmounts = (s.experience.match(/\$[\d,]+|\d+[KkMm]\b/g) || []).length;
  const metrics = (
    s.experience.match(
      /\d+\s*(users|customers|clients|projects|team|members|people|staff|employees|reports|systems|applications)/gi,
    ) || []
  ).length;
  const impactScore = Math.min(100, numbers * 15 + dollarAmounts * 12 + metrics * 10 + verbHits * 5);

  const allFields: (keyof StructuredResume)[] = [
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
  ];
  const filled = allFields.filter((k) => s[k].trim().length > 3).length;
  const completenessScore = Math.min(100, (filled / allFields.length) * 100);

  const overall = Math.round(
    structureScore * 0.25 +
      keywordsScore * 0.2 +
      readabilityScore * 0.2 +
      impactScore * 0.15 +
      completenessScore * 0.2,
  );

  return {
    overall,
    structure: rateScore(structureScore),
    keywords: rateScore(keywordsScore),
    readability: rateScore(readabilityScore),
    impact: rateScore(impactScore),
    completeness: rateScore(completenessScore),
  };
}

export function buildSuggestions(s: StructuredResume): Suggestion[] {
  const tips: Suggestion[] = [];
  if (!s.name.trim())
    tips.push({
      id: "name",
      title: "Missing Name",
      titleAr: "الاسم غير موجود",
      description: "Add your full name at the top of your resume.",
      descriptionAr: "أضف اسمك الكامل في أعلى السيرة.",
      field: "name",
      fix: "",
      actionLabel: "Add Name",
      actionLabelAr: "أضف الاسم",
    });
  if (!s.contact.trim())
    tips.push({
      id: "contact",
      title: "Missing Contact Info",
      titleAr: "بيانات الاتصال ناقصة",
      description: "Add email, phone number, LinkedIn, and location.",
      descriptionAr: "أضف البريد الإلكتروني ورقم الجوال وLinkedIn والموقع.",
      field: "contact",
      fix: "",
      actionLabel: "Add Contact",
      actionLabelAr: "أضف بيانات الاتصال",
    });
  if (s.summary.trim().length < 40)
    tips.push({
      id: "summary",
      title: "Weak Summary",
      titleAr: "الملخص المهني ضعيف",
      description: "Add a concise professional summary (3-5 sentences).",
      descriptionAr: "أضف ملخصًا مهنيًا مختصرًا (3-5 جمل).",
      field: "summary",
      fix: "",
      actionLabel: "Edit Summary",
      actionLabelAr: "عدّل الملخص",
    });
  if (!/\d+%?/.test(s.experience))
    tips.push({
      id: "metrics",
      title: "Missing Measurable Impact",
      titleAr: "لا توجد إنجازات رقمية",
      description: "Add quantified achievements (e.g., 'Increased sales by 30%').",
      descriptionAr: "أضف إنجازات رقمية قابلة للقياس (مثال: 'زيادة المبيعات 30%').",
      field: "experience",
      fix: "",
      actionLabel: "Add Metrics",
      actionLabelAr: "أضف أرقام",
    });
  if (splitLines(s.skills).length < 5)
    tips.push({
      id: "skills",
      title: "Skills Need More Depth",
      titleAr: "قسم المهارات يحتاج تعزيز",
      description: "Add 8-15 relevant skills for your target role.",
      descriptionAr: "أضف 8-15 مهارة ذات صلة بالوظيفة المستهدفة.",
      field: "skills",
      fix: "",
      actionLabel: "Add Skills",
      actionLabelAr: "أضف مهارات",
    });
  if (!s.education.trim())
    tips.push({
      id: "education",
      title: "Education Missing",
      titleAr: "قسم التعليم ناقص",
      description: "Add your educational background.",
      descriptionAr: "أضف خلفيتك التعليمية.",
      field: "education",
      fix: "",
      actionLabel: "Add Education",
      actionLabelAr: "أضف التعليم",
    });
  if (!s.certifications.trim())
    tips.push({
      id: "certifications",
      title: "No Certifications",
      titleAr: "لا توجد شهادات",
      description: "Add professional certifications or relevant courses.",
      descriptionAr: "أضف الشهادات المهنية أو الدورات.",
      field: "certifications",
      fix: "",
      actionLabel: "Add Certs",
      actionLabelAr: "أضف شهادات",
    });
  if (!s.projects.trim())
    tips.push({
      id: "projects",
      title: "Projects Missing",
      titleAr: "قسم المشاريع غير موجود",
      description: "Add notable projects to showcase your work.",
      descriptionAr: "أضف مشاريع بارزة لعرض أعمالك.",
      field: "projects",
      fix: "",
      actionLabel: "Add Projects",
      actionLabelAr: "أضف مشاريع",
    });
  if (!s.languages.trim())
    tips.push({
      id: "languages",
      title: "Languages Missing",
      titleAr: "قسم اللغات غير موجود",
      description: "Add languages with proficiency levels.",
      descriptionAr: "أضف اللغات ومستوى الإتقان.",
      field: "languages",
      fix: "",
      actionLabel: "Add Languages",
      actionLabelAr: "أضف لغات",
    });

  const expRoles = s.experience.split(/\n{2,}/).filter(Boolean);
  if (expRoles.length > 0) {
    const totalBullets = (s.experience.match(/^•/gm) || []).length;
    if (totalBullets < expRoles.length * 3) {
      tips.push({
        id: "exp_bullets",
        title: "Add More Bullet Points",
        titleAr: "أضف المزيد من النقاط",
        description: "Each role should have 3-6 achievement-focused bullet points.",
        descriptionAr: "يجب أن يحتوي كل دور على 3-6 نقاط تركز على الإنجازات.",
        field: "experience",
        fix: "",
        actionLabel: "Edit Experience",
        actionLabelAr: "عدّل الخبرات",
      });
    }
  }

  const expLower = s.experience.toLowerCase();
  const weakVerbs = ["responsible for", "worked on", "helped with", "assisted in", "involved in"];
  const hasWeakVerbs = weakVerbs.some((v) => expLower.includes(v));
  if (hasWeakVerbs) {
    tips.push({
      id: "weak_verbs",
      title: "Replace Weak Verbs",
      titleAr: "استبدل الأفعال الضعيفة",
      description: "Replace 'Responsible for' with action verbs like 'Led', 'Managed', 'Developed'.",
      descriptionAr: "استبدل 'مسؤول عن' بأفعال قوية مثل 'قاد'، 'أدار'، 'طوّر'.",
      field: "experience",
      fix: "",
      actionLabel: "Improve Experience",
      actionLabelAr: "حسّن الخبرات",
    });
  }

  return tips;
}

// ── HTML building ───────────────────────────────────────────────
function buildParagraphs(lines: string[]): string {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function buildList(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function buildExperienceHtml(content: string): string {
  const groups = content
    .split(/\n{2,}/)
    .map((g) => g.trim())
    .filter(Boolean);
  return groups
    .map((group) => {
      const lines = group
        .split("\n")
        .map((l) => cleanArtifacts(l))
        .filter(Boolean);
      if (!lines.length) return "";
      const header = lines[0];
      const bullets = lines.slice(1).map(normalizeBulletLine).filter(Boolean);
      return `<div data-role-block="true"><p data-role-header="true"><strong>${escapeHtml(header)}</strong></p>${bullets.length ? buildList(bullets) : ""}</div>`;
    })
    .join("");
}

export function structuredToHtml(s: StructuredResume, lang: string): string {
  const data = enrichStructuredResume(s);
  const lk = lang === "ar" ? "ar" : "en";
  const parts: string[] = [];
  parts.push(`<div data-resume-root="true">`);
  parts.push(`<section data-resume-header="name">`);
  if (data.name.trim()) parts.push(`<h1>${escapeHtml(data.name.trim())}</h1>`);
  parts.push(`</section>`);
  parts.push(`<section data-resume-header="job_title">`);
  if (data.job_title.trim()) parts.push(`<h3>${escapeHtml(data.job_title.trim())}</h3>`);
  parts.push(`</section>`);
  parts.push(`<section data-resume-header="contact">`);
  if (data.contact.trim()) parts.push(buildParagraphs(splitLines(data.contact)));
  parts.push(`</section>`);
  if (data.name || data.job_title || data.contact) parts.push(`<hr />`);

  for (const key of SECTION_ORDER) {
    const content = cleanArtifacts(data[key]);
    if (!content) continue;
    const label = SECTION_LABELS[key][lk];
    parts.push(`<section data-resume-section="${key}">`);
    parts.push(`<h2 data-section-title="${key}">${escapeHtml(label)}</h2>`);
    if (key === "summary") parts.push(buildParagraphs(splitLines(content)));
    else if (key === "experience") parts.push(buildExperienceHtml(content));
    else if (key === "skills" || key === "certifications" || key === "projects" || key === "languages") {
      const items = splitLines(content)
        .map((x) => x.replace(/^[•▪*\-]\s*/, "").trim())
        .filter(Boolean);
      parts.push(buildList(items));
    } else if (key === "education") parts.push(buildParagraphs(splitLines(content)));
    parts.push(`</section>`);
  }
  parts.push(`</div>`);
  return parts.join("");
}

// ── HTML parsing ────────────────────────────────────────────────
function parseSectionChildrenToLines(sectionEl: Element): string[] {
  const lines: string[] = [];
  const children = Array.from(sectionEl.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      for (const li of Array.from(child.querySelectorAll(":scope > li"))) {
        const txt = cleanArtifacts(li.textContent || "");
        if (txt) lines.push(`• ${txt}`);
      }
      continue;
    }
    if (tag === "p" || tag === "div" || tag === "h3" || tag === "h4") {
      const txt = cleanArtifacts(child.textContent || "");
      if (txt) lines.push(txt);
    }
  }
  return lines;
}

function parseExperienceSection(sectionEl: Element): string {
  const roleBlocks = Array.from(sectionEl.querySelectorAll('[data-role-block="true"]'));
  if (roleBlocks.length) {
    const groups = roleBlocks.map((block) => {
      const header =
        cleanArtifacts(block.querySelector('[data-role-header="true"]')?.textContent || "") ||
        cleanArtifacts(block.querySelector("p,strong")?.textContent || "");
      const bullets = Array.from(block.querySelectorAll("li"))
        .map((li) => cleanArtifacts(li.textContent || ""))
        .filter(Boolean)
        .map((txt) => `• ${txt}`);
      return [header, ...bullets].filter(Boolean).join("\n");
    });
    return groups.filter(Boolean).join("\n\n");
  }
  return parseSectionChildrenToLines(sectionEl).join("\n");
}

function parseListSection(sectionEl: Element): string {
  const items = Array.from(sectionEl.querySelectorAll("li"))
    .map((li) => cleanArtifacts(li.textContent || ""))
    .filter(Boolean);
  if (items.length) return items.join("\n");
  return parseSectionChildrenToLines(sectionEl)
    .map((x) => x.replace(/^[•▪*\-]\s*/, "").trim())
    .filter(Boolean)
    .join("\n");
}

function parsePlainSection(sectionEl: Element): string {
  return parseSectionChildrenToLines(sectionEl)
    .map((x) => x.replace(/^[•▪*\-]\s*/, "").trim())
    .filter(Boolean)
    .join("\n");
}

export function htmlToStructured(html: string, lang: string): StructuredResume {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const result = { ...EMPTY_STRUCTURED };

  const nameSection = doc.querySelector('[data-resume-header="name"]');
  const titleSection = doc.querySelector('[data-resume-header="job_title"]');
  const contactSection = doc.querySelector('[data-resume-header="contact"]');

  if (nameSection) result.name = cleanArtifacts(nameSection.textContent || "");
  if (titleSection) result.job_title = cleanArtifacts(titleSection.textContent || "");
  if (contactSection) result.contact = parsePlainSection(contactSection);

  for (const key of SECTION_ORDER) {
    const sectionEl = doc.querySelector(`[data-resume-section="${key}"]`);
    if (!sectionEl) continue;
    if (key === "experience") result.experience = parseExperienceSection(sectionEl);
    else if (key === "skills" || key === "certifications" || key === "projects" || key === "languages")
      result[key] = parseListSection(sectionEl);
    else result[key] = parsePlainSection(sectionEl);
  }

  const hasAnyData = Object.values(result).some((v) => v.trim());
  if (!hasAnyData) {
    const labelToField: Record<string, keyof StructuredResume> = {};
    Object.entries(SECTION_LABELS).forEach(([key, labels]) => {
      if (PROTECTED_FIELDS.includes(key as keyof StructuredResume)) return;
      labelToField[labels.en.toLowerCase()] = key as keyof StructuredResume;
      labelToField[labels.ar] = key as keyof StructuredResume;
    });

    let currentSection: keyof StructuredResume | null = null;
    let headerDone = false;
    let gotName = false;
    let gotTitle = false;

    for (const node of Array.from(doc.body.childNodes)) {
      const el = node as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      const text = cleanArtifacts(el.textContent || "");
      if (!text && tag !== "hr") continue;
      if (tag === "hr") {
        headerDone = true;
        currentSection = null;
        continue;
      }
      if (!headerDone) {
        if ((tag === "h1" || tag === "h2") && !gotName) {
          const maybeField = labelToField[text.toLowerCase()] || labelToField[text];
          if (maybeField) {
            currentSection = maybeField;
            headerDone = true;
          } else {
            result.name = text;
            gotName = true;
          }
          continue;
        }
        if (tag === "h3" && gotName && !gotTitle) {
          result.job_title = text;
          gotTitle = true;
          continue;
        }
        if ((tag === "p" || tag === "div") && gotName) {
          result.contact += (result.contact ? "\n" : "") + text;
          continue;
        }
      }
      if (tag === "h2" || tag === "h3") {
        const key = text.toLowerCase();
        const matchedField = labelToField[key] || labelToField[text];
        if (matchedField) {
          currentSection = matchedField;
          headerDone = true;
          continue;
        }
      }
      if (!currentSection) continue;
      if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(el.querySelectorAll("li"))) {
          const liText = cleanArtifacts(li.textContent || "");
          if (liText) result[currentSection] += (result[currentSection] ? "\n" : "") + `• ${liText}`;
        }
      } else {
        result[currentSection] += (result[currentSection] ? "\n" : "") + text;
      }
    }
  }

  return enrichStructuredResume(result);
}

// ── Safety validation for AI-optimized sections ─────────────────
export function sanitizeOptimizedSection(
  field: keyof StructuredResume,
  originalValue: string,
  newValue: string,
): string {
  const oldVal = cleanArtifacts(originalValue);
  const newVal = cleanArtifacts(newValue);

  if (!newVal) return oldVal;
  if (!oldVal && newVal) return oldVal;

  if (field === "experience") {
    const countBlocks = (v: string) =>
      v
        .split(/\n{2,}/)
        .map((x) => x.trim())
        .filter(Boolean).length;
    const countLn = (v: string) => splitLines(v).length;
    const oldRoles = countBlocks(oldVal);
    const newRoles = countBlocks(newVal);
    const oldLines = countLn(oldVal);
    const newLines = countLn(newVal);
    if (newRoles > Math.max(oldRoles + 1, oldRoles * 2)) return oldVal;
    if (newLines > Math.max(oldLines + 6, oldLines * 2)) return oldVal;
    return newVal;
  }

  const oldLines = splitLines(oldVal).length;
  const newLines = splitLines(newVal).length;
  if (newLines < Math.max(1, Math.floor(oldLines * 0.4))) return oldVal;

  return newVal;
}

export function sanitizeOptimizedSections(
  original: StructuredResume,
  candidate: Partial<StructuredResume>,
): StructuredResume {
  const merged: StructuredResume = { ...original };
  for (const f of PROTECTED_FIELDS) merged[f] = original[f];
  for (const field of IMPROVABLE_FIELDS) {
    merged[field] = sanitizeOptimizedSection(field, original[field], candidate[field] || "");
  }
  return enrichStructuredResume(merged);
}