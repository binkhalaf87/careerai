import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
import pdf from "npm:pdf-parse@1.1.1/lib/pdf-parse.js";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRUCTURED_FIELDS = [
  "full_name",
  "job_title",
  "contact_info",
  "summary",
  "work_experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
] as const;

type StructuredKey = (typeof STRUCTURED_FIELDS)[number];
type StructuredResume = Record<StructuredKey, string>;

const EMPTY_STRUCTURED: StructuredResume = Object.fromEntries(
  STRUCTURED_FIELDS.map((f) => [f, ""]),
) as StructuredResume;

// ── Generic helpers ─────────────────────────────────────────────
function normalizeWhitespace(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanArtifacts(text: string): string {
  return normalizeWhitespace(
    String(text || "")
      .replace(/\x00/g, "")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "")
      .replace(/\u200D/g, "")
      .replace(/\uFEFF/g, "")
      .replace(/\[Type here\]/gi, "")
      .replace(/\bmissing_information\b/gi, "")
      .replace(/\bundefined\b/gi, "")
      .replace(/\bnull\b/gi, "")
      .replace(/\bN\/A\b/gi, "")
      .replace(/^\s*page\s+\d+\s*$/gim, "")
      .replace(/^\s*curriculum vitae\s*$/gim, "")
      .replace(/^\s*resume\s*$/gim, "")
      .replace(/^\s*cv\s*$/gim, "")
      .replace(/^\s*[-•▪*]+\s*$/gm, ""),
  );
}

function splitLines(text: string): string[] {
  return cleanArtifacts(text)
    .split("\n")
    .map((l) => cleanArtifacts(l))
    .filter(Boolean);
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const v = cleanArtifacts(raw);
    const key = v.toLowerCase().trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function normalizeHeadingKey(text: string): string {
  return cleanArtifacts(text)
    .toLowerCase()
    .replace(/[:_|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBulletLine(line: string): string {
  return cleanArtifacts(line)
    .replace(/^[•▪*\-]+\s*/, "")
    .trim();
}

function toBulletList(lines: string[]): string[] {
  return uniqueLines(
    lines
      .map(normalizeBulletLine)
      .filter(Boolean)
      .map((x) => `• ${x}`),
  );
}

function splitSmartList(text: string): string[] {
  return uniqueLines(
    cleanArtifacts(text)
      .split(/\n|,|،|;|•|▪|\|/g)
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

function detectLanguage(text: string): "ar" | "en" {
  const arabicCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  return arabicCount > latinCount ? "ar" : "en";
}

// ── Contact detection helpers ───────────────────────────────────
function isLikelyEmail(line: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line);
}

function isLikelyPhone(line: string): boolean {
  return (
    /(\+?\d[\d\s\-()]{7,}\d)/.test(line) ||
    /(05\d{8})/.test(line) ||
    /(\+966\d{9})/.test(line) ||
    /(\+20\d{10})/.test(line) ||
    /(\+971\d{9})/.test(line) ||
    /(\+\d{1,3}[\s\-]?\d{6,})/.test(line)
  );
}

function isLikelyLinkedIn(line: string): boolean {
  return /linkedin\.com|linked\s*in/i.test(line);
}

function isLikelyWebsite(line: string): boolean {
  return /https?:\/\/|www\.|github\.com|portfolio|behance/i.test(line);
}

function isLikelyLocation(line: string): boolean {
  return /(riyadh|jeddah|dammam|mecca|medina|ksa|saudi|saudi arabia|الرياض|جدة|الدمام|مكة|المدينة|السعودية|المملكة العربية السعودية|cairo|alexandria|dubai|abu dhabi|القاهرة|الإسكندرية|دبي|أبوظبي|amman|beirut|doha|muscat|kuwait|manama|عمان|بيروت|الدوحة|مسقط|الكويت|المنامة)/i.test(
    line,
  );
}

function isLikelyContactLine(line: string): boolean {
  return (
    isLikelyEmail(line) ||
    isLikelyPhone(line) ||
    isLikelyLinkedIn(line) ||
    isLikelyWebsite(line) ||
    isLikelyLocation(line)
  );
}

function looksLikeDateRange(line: string): boolean {
  return /(\b(19|20)\d{2}\b)|present|current|to date|till now|ongoing|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|حتى الآن|حاليا|حالياً|الآن/i.test(
    line,
  );
}

function looksLikeRoleHeader(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length > 140) return false;
  const hasDate = looksLikeDateRange(t);
  const hasSeparator = /[|–—]/.test(t) || /\t/.test(t);
  const hasRoleWords =
    /(manager|engineer|specialist|supervisor|analyst|consultant|developer|officer|lead|administrator|coordinator|trainer|director|architect|managerial|designer|accountant|teacher|nurse|doctor|technician|intern|assistant|associate|executive|representative|secretary|clerk|receptionist|مدير|مهندس|أخصائي|مشرف|محلل|استشاري|مطور|مسؤول|قائد|منسق|مدرب|محاسب|معلم|ممرض|طبيب|فني|متدرب|مساعد|سكرتير|موظف)/i.test(
      t,
    );
  const hasCompanyWords =
    /(company|corp|inc|llc|ltd|group|hospital|ministry|university|school|agency|solutions|network|technologies|systems|consulting|services|شركة|مؤسسة|مجموعة|مستشفى|وزارة|جامعة|معهد|تقنية)/i.test(
      t,
    );

  // Strong: date + role/company
  if (hasDate && (hasRoleWords || hasCompanyWords)) return true;
  // Strong: separator + (role or company)
  if (hasSeparator && (hasRoleWords || hasCompanyWords)) return true;
  // Medium: date + separator (likely "Company | Jan 2020 - Present")
  if (hasDate && hasSeparator && t.length < 80) return true;

  return false;
}

function isProbablyName(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length < 3 || t.length > 60) return false;
  if (isLikelyContactLine(t)) return false;
  if (looksLikeRoleHeader(t)) return false;
  if (
    /^(summary|experience|education|skills|certifications|projects|languages|الملخص|الخبرة|التعليم|المهارات|الشهادات|المشاريع|اللغات)$/i.test(
      t,
    )
  )
    return false;
  const wordCount = t.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 6) return false;
  if (/\d/.test(t) && !/[\u0600-\u06FF]/.test(t)) return false;
  // Should not look like a sentence (no verbs/common words at start)
  if (/^(i |my |the |a |an |with |from |to )/i.test(t)) return false;
  return true;
}

function isProbablyJobTitle(line: string): boolean {
  const t = cleanArtifacts(line);
  if (!t || t.length < 3 || t.length > 80) return false;
  if (isLikelyContactLine(t)) return false;
  if (t.split(/\s+/).length > 8) return false;
  return /(manager|engineer|specialist|supervisor|analyst|consultant|developer|lead|architect|officer|designer|accountant|teacher|nurse|doctor|technician|administrator|coordinator|senior|junior|executive|intern|assistant|associate|representative|مدير|مهندس|أخصائي|مشرف|محلل|استشاري|مطور|قائد|مسؤول|محاسب|معلم|ممرض|طبيب|فني|متدرب|مساعد)/i.test(
    t,
  );
}

function evaluateQuality(text: string, fileSize: number): { quality: string; score: number } {
  const cleaned = cleanArtifacts(text);
  const charCount = cleaned.length;
  const wordCount = cleaned.split(/\s+/).filter((w) => w.length > 0).length;
  const ratio = charCount / Math.max(fileSize, 1);
  if (charCount < 50) return { quality: "low_quality", score: 0.1 };
  if (wordCount < 15) return { quality: "low_quality", score: 0.2 };
  const printable = cleaned.replace(
    /[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\n\t]/g,
    "",
  );
  const printableRatio = printable.length / Math.max(charCount, 1);
  if (printableRatio < 0.7) return { quality: "low_quality", score: printableRatio };
  if (ratio < 0.01 && fileSize > 10000) return { quality: "low_quality", score: 0.3 };
  if (ratio < 0.05 && fileSize > 5000) return { quality: "medium", score: 0.6 };
  return { quality: "good", score: 1 };
}

// ── Section headings map ────────────────────────────────────────
const COMMON_SECTION_HEADINGS: Record<string, StructuredKey> = {
  "job title": "job_title",
  title: "job_title",
  position: "job_title",
  headline: "job_title",
  contact: "contact_info",
  "contact information": "contact_info",
  "contact info": "contact_info",
  "contact details": "contact_info",
  "personal information": "contact_info",
  "personal details": "contact_info",
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
  experience: "work_experience",
  "work experience": "work_experience",
  "employment history": "work_experience",
  employment: "work_experience",
  "professional experience": "work_experience",
  "career history": "work_experience",
  "work history": "work_experience",
  "relevant experience": "work_experience",
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
  licenses: "certifications",
  courses: "certifications",
  training: "certifications",
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
  "بيانات الاتصال": "contact_info",
  "معلومات الاتصال": "contact_info",
  "البيانات الشخصية": "contact_info",
  "المعلومات الشخصية": "contact_info",
  الملخص: "summary",
  نبذة: "summary",
  "الملخص المهني": "summary",
  "الهدف الوظيفي": "summary",
  "نبذة مهنية": "summary",
  "نبذة عني": "summary",
  "ملخص مهني": "summary",
  "الخبرة العملية": "work_experience",
  الخبرات: "work_experience",
  "الخبرات العملية": "work_experience",
  "الخبرة المهنية": "work_experience",
  "تاريخ التوظيف": "work_experience",
  المهارات: "skills",
  "المهارات التقنية": "skills",
  الكفاءات: "skills",
  "المهارات المهنية": "skills",
  "المهارات الأساسية": "skills",
  التعليم: "education",
  المؤهلات: "education",
  "المؤهلات العلمية": "education",
  "الخلفية الأكاديمية": "education",
  "المؤهلات الأكاديمية": "education",
  الشهادات: "certifications",
  الدورات: "certifications",
  "الدورات التدريبية": "certifications",
  الاعتمادات: "certifications",
  "الشهادات المهنية": "certifications",
  "التطوير المهني": "certifications",
  المشاريع: "projects",
  اللغات: "languages",
};

// ── Fuzzy heading matching ──────────────────────────────────────
function fuzzyMatchHeading(line: string): StructuredKey | null {
  const key = normalizeHeadingKey(line);
  // Exact match
  if (COMMON_SECTION_HEADINGS[key]) return COMMON_SECTION_HEADINGS[key];

  // Check if key starts with or contains a known heading
  for (const [heading, field] of Object.entries(COMMON_SECTION_HEADINGS)) {
    if (key.startsWith(heading) && key.length < heading.length + 15) return field;
    if (heading.startsWith(key) && key.length > 4) return field;
  }

  return null;
}

// ── Validation: check if a line belongs to a given section ───────
function lineMatchesSection(line: string, section: StructuredKey): boolean {
  const t = cleanArtifacts(line).toLowerCase();
  if (!t) return true;

  // Contact lines should ONLY be in contact_info
  if (isLikelyContactLine(line)) return section === "contact_info";

  // Education-specific content should NOT appear in skills
  if (section === "skills") {
    if (/\b(bachelor|master|diploma|phd|degree|university|college|بكالوريوس|ماجستير|دبلوم|جامعة|كلية)\b/i.test(t))
      return false;
    if (looksLikeRoleHeader(line)) return false;
  }

  // Skills-like content should NOT appear in education
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

  // Experience-like lines should NOT go into skills or education
  if (section === "skills" || section === "education" || section === "certifications") {
    if (looksLikeRoleHeader(line)) return false;
  }

  // Summary content should be text, not lists of items
  if (section === "summary") {
    if (/^[•▪*\-]/.test(t) && t.length < 40) return false;
  }

  return true;
}

// ── Text formatting helpers ─────────────────────────────────────
function formatSummaryText(raw: string): string {
  return splitLines(raw).join("\n");
}

function formatListText(raw: string): string {
  return splitSmartList(raw).join("\n");
}

function formatEducationText(raw: string): string {
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
    if (headerLike && current.length > 0) {
      groups.push(current.trim());
      current = line;
    } else {
      current += ` | ${line}`;
    }
  }
  if (current.trim()) groups.push(current.trim());
  return uniqueLines(groups).join("\n");
}

function formatExperienceText(raw: string): string {
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
    // Skip contact lines that leaked into experience
    if (isLikelyContactLine(line) && !looksLikeRoleHeader(line)) continue;

    const headerLike = looksLikeRoleHeader(line);
    const bulletLike = /^[•▪*\-]/.test(line);

    if (headerLike) {
      flush();
      current.push(cleanArtifacts(line));
      continue;
    }

    // Date-only line after a header = part of header
    if (current.length === 1 && looksLikeDateRange(line) && !bulletLike && line.length < 50) {
      current[0] = `${current[0]} | ${cleanArtifacts(line)}`;
      continue;
    }

    // Company name line after a role title (short, no bullet, no date)
    if (current.length === 1 && !bulletLike && !looksLikeDateRange(line) && line.length < 60 && line.length > 2) {
      const prevIsRole = isProbablyJobTitle(current[0]);
      if (prevIsRole) {
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
      const bullets = toBulletList(group.slice(1));
      return [header, ...bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function postProcessStructured(input: StructuredResume): StructuredResume {
  const out: StructuredResume = {
    full_name: cleanArtifacts(input.full_name),
    job_title: cleanArtifacts(input.job_title),
    contact_info: uniqueLines(splitLines(input.contact_info)).join("\n"),
    summary: formatSummaryText(input.summary),
    work_experience: formatExperienceText(input.work_experience),
    skills: formatListText(input.skills),
    education: formatEducationText(input.education),
    certifications: formatListText(input.certifications),
    projects: formatListText(input.projects),
    languages: formatListText(input.languages),
  };

  // Infer job title from first experience header if missing
  if (!out.job_title && out.work_experience) {
    const firstHeader = out.work_experience.split("\n").find((l) => looksLikeRoleHeader(l));
    if (firstHeader) {
      const parts = firstHeader.split(/[|–—]/);
      out.job_title = cleanArtifacts(parts[0] || firstHeader);
    }
  }

  // Generate summary if empty
  if (!out.summary) {
    const lang = detectLanguage(`${out.work_experience}\n${out.skills}`);
    const skills = splitLines(out.skills).slice(0, 6);
    const firstExp = out.work_experience.split(/\n{2,}/)[0]?.split("\n")[0] || "";
    if (lang === "ar") {
      const parts: string[] = [];
      if (out.job_title) parts.push(`متخصص في ${out.job_title}`);
      if (firstExp) parts.push(`يمتلك خبرة عملية في ${firstExp}`);
      if (skills.length) parts.push(`وتشمل المهارات الأساسية: ${skills.join("، ")}`);
      out.summary = parts.join(" ");
    } else {
      const parts: string[] = [];
      if (out.job_title) parts.push(`${out.job_title} professional`);
      if (firstExp) parts.push(`with experience in ${firstExp}`);
      if (skills.length) parts.push(`Skilled in ${skills.join(", ")}`);
      out.summary = parts.join(". ");
    }
  }

  // Cross-check: remove education lines from skills
  if (out.skills && out.education) {
    const eduLines = new Set(splitLines(out.education).map((l) => l.toLowerCase().trim()));
    const filteredSkills = splitLines(out.skills).filter((l) => !eduLines.has(l.toLowerCase().trim()));
    out.skills = uniqueLines(filteredSkills).join("\n");
  }

  // Cross-check: remove experience lines from skills
  if (out.skills && out.work_experience) {
    const expLines = new Set(splitLines(out.work_experience).map((l) => l.toLowerCase().trim()));
    const filteredSkills = splitLines(out.skills).filter((l) => !expLines.has(l.toLowerCase().trim()));
    out.skills = uniqueLines(filteredSkills).join("\n");
  }

  return out;
}

// ── Experience level detection ──────────────────────────────────
function detectExperienceLevel(text: string, structured: StructuredResume): string {
  const exp = structured.work_experience.toLowerCase();
  const yearMatches = exp.match(/\b(19|20)\d{2}\b/g) || [];
  const years = yearMatches.map(Number).sort();

  if (years.length >= 2) {
    const span = years[years.length - 1] - years[0];
    if (span >= 10) return "senior";
    if (span >= 5) return "mid-level";
    if (span >= 2) return "junior";
  }

  const seniorWords = /(senior|lead|principal|director|manager|head of|vp|vice president|chief|مدير|رئيس|قائد)/i;
  const juniorWords = /(junior|intern|trainee|fresh|entry.level|متدرب|حديث التخرج)/i;

  if (seniorWords.test(exp) || seniorWords.test(structured.job_title)) return "senior";
  if (juniorWords.test(exp) || juniorWords.test(structured.job_title)) return "entry-level";

  const bulletCount = (exp.match(/•/g) || []).length;
  if (bulletCount > 15) return "senior";
  if (bulletCount > 8) return "mid-level";
  if (bulletCount > 3) return "junior";

  return "entry-level";
}

// ── PDF extraction ──────────────────────────────────────────────
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    const renderPage = (pageData: any) => {
      const options = { normalizeWhitespace: true, disableCombineTextItems: false };
      return pageData.getTextContent(options).then((textContent: any) => {
        let lastY: number | null = null;
        let text = "";
        for (const item of textContent.items) {
          const currentY = item.transform?.[5] ?? 0;
          if (lastY !== null && Math.abs(currentY - lastY) > 5) text += "\n";
          else if (lastY !== null && text.length > 0 && !text.endsWith(" ") && !text.endsWith("\n")) text += " ";
          text += item.str;
          lastY = currentY;
        }
        return text;
      });
    };
    const result = await pdf(buffer, { pagerender: renderPage });
    let text = result.text || "";
    if (cleanArtifacts(text).replace(/\s/g, "").length < 30) {
      const fallback = await pdf(buffer, { pagerender: undefined });
      if ((fallback.text || "").length > text.length) text = fallback.text || "";
    }
    return text;
  } catch (e) {
    console.error("PDF extraction error, trying fallback:", e);
    const result = await pdf(buffer, { pagerender: undefined });
    return result.text || "";
  }
}

// ── DOCX extraction ─────────────────────────────────────────────
async function extractDOCXText(uint8: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(uint8);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("Invalid DOCX: word/document.xml not found");
  const xmlContent = await docXml.async("string");
  const extraTexts: string[] = [];
  for (const path of ["word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"]) {
    const f = zip.file(path);
    if (f) {
      const hfXml = await f.async("string");
      const hfText = extractTextFromXml(hfXml);
      if (hfText.trim()) extraTexts.push(hfText.trim());
    }
  }
  const mainText = extractTextFromXml(xmlContent);
  const combined = [...extraTexts, mainText].filter(Boolean).join("\n");
  return (
    combined ||
    xmlContent
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTextFromXml(xml: string): string {
  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paraRegex.exec(xml)) !== null) {
    const paraContent = match[1];
    const texts: string[] = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(paraContent)) !== null) {
      if (textMatch[1]) texts.push(textMatch[1]);
    }
    const hasTab = /<w:tab\s*\/?>/.test(paraContent);
    const joined = texts.join(hasTab ? "\t" : "");
    const hasBullet = /<w:numPr>/.test(paraContent) || /<w:ilvl/.test(paraContent);
    if (hasBullet && joined.trim()) paragraphs.push("• " + joined.trim());
    else if (joined.trim()) paragraphs.push(joined);
  }
  return paragraphs.join("\n");
}

// ── Heuristic section detection (NO AI) ─────────────────────────
function heuristicSectionDetection(text: string, language: "ar" | "en"): StructuredResume {
  const result = { ...EMPTY_STRUCTURED };
  const lines = splitLines(text);
  if (!lines.length) return result;

  console.log(`[extract-text] Starting heuristic detection on ${lines.length} lines, lang=${language}`);

  // ── PHASE 1: Extract contact info via regex from FULL text ────
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phoneMatch =
    text.match(/(\+?\d[\d\s\-()]{7,}\d)|(05\d{8})|(\+966\d{9})|(\+20\d{10})|(\+971\d{9})|(\+\d{1,3}[\s\-]?\d{6,})/g) ||
    [];
  const linkedInMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/gi) || [];
  const locationMatch =
    text.match(
      /(?:الرياض|جدة|الدمام|مكة|المدينة|Riyadh|Jeddah|Dammam|Mecca|Medina|Saudi Arabia|المملكة العربية السعودية|Cairo|Alexandria|Dubai|Abu Dhabi|القاهرة|الإسكندرية|دبي|أبوظبي|Amman|Beirut|Doha|Muscat|Kuwait|Manama)[^,\n]*/gi,
    ) || [];

  const contactParts = uniqueLines([...emailMatch, ...phoneMatch, ...linkedInMatch, ...locationMatch]);
  result.contact_info = contactParts.join("\n");
  const contactSet = new Set(contactParts.map((c) => c.toLowerCase().trim()));

  console.log(`[extract-text] Phase 1: found ${contactParts.length} contact items`);

  // ── PHASE 2: Detect name & job title from top lines ───────────
  const topLines = lines.slice(0, 12);
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i];
    const hk = normalizeHeadingKey(line);
    const matched = fuzzyMatchHeading(line);
    if (matched && matched !== "contact_info") break; // hit a section heading, stop header scan

    if (!result.full_name && isProbablyName(line) && !contactSet.has(line.toLowerCase().trim())) {
      result.full_name = line;
      console.log(`[extract-text] Phase 2: detected name="${line}"`);
      continue;
    }
    if (
      result.full_name &&
      !result.job_title &&
      isProbablyJobTitle(line) &&
      !contactSet.has(line.toLowerCase().trim())
    ) {
      result.job_title = line;
      console.log(`[extract-text] Phase 2: detected job_title="${line}"`);
      continue;
    }
    // Collect additional contact lines from header
    if (isLikelyContactLine(line)) {
      const lineLower = line.toLowerCase().trim();
      if (!contactSet.has(lineLower)) {
        result.contact_info += (result.contact_info ? "\n" : "") + line;
        contactSet.add(lineLower);
      }
    }
  }

  // ── PHASE 3: Detect section boundaries ────────────────────────
  const boundaries: { field: StructuredKey; startIdx: number; heading: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const matched = fuzzyMatchHeading(lines[i]);
    if (matched && lines[i].length < 80) {
      boundaries.push({ field: matched, startIdx: i + 1, heading: lines[i] });
    }
  }
  boundaries.sort((a, b) => a.startIdx - b.startIdx);

  console.log(
    `[extract-text] Phase 3: found ${boundaries.length} section boundaries: ${boundaries.map((b) => `${b.field}@${b.startIdx}`).join(", ")}`,
  );

  // ── PHASE 4: Assign lines to sections with validation ─────────
  for (let i = 0; i < boundaries.length; i++) {
    const { field, startIdx } = boundaries[i];
    const endIdx = i + 1 < boundaries.length ? boundaries[i + 1].startIdx - 1 : lines.length;
    const sectionLines: string[] = [];

    for (let j = startIdx; j < endIdx; j++) {
      const line = lines[j];
      if (!line.trim()) continue;

      // Skip lines that are contact info (already extracted)
      if (isLikelyContactLine(line) && field !== "contact_info") continue;

      // Skip lines that are section headings themselves
      if (fuzzyMatchHeading(line) && line.length < 80) continue;

      // Validate line belongs to this section
      if (lineMatchesSection(line, field)) {
        sectionLines.push(line);
      }
      // If line doesn't match, try to route it to the correct section
      else if (looksLikeRoleHeader(line) && field !== "work_experience") {
        result.work_experience += (result.work_experience ? "\n" : "") + line;
      }
    }

    if (sectionLines.length) {
      if (result[field]) {
        result[field] += "\n" + sectionLines.join("\n");
      } else {
        result[field] = sectionLines.join("\n");
      }
    }
  }

  // ── PHASE 5: Handle unassigned content (lines before first heading) ──
  const firstBoundaryIdx = boundaries.length > 0 ? boundaries[0].startIdx - 1 : lines.length;
  for (let i = 0; i < firstBoundaryIdx; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line === result.full_name || line === result.job_title) continue;
    if (contactSet.has(line.toLowerCase().trim())) continue;
    if (isLikelyContactLine(line)) continue;

    const hk = normalizeHeadingKey(line);
    if (COMMON_SECTION_HEADINGS[hk]) continue;

    // Long lines before any section heading = likely summary
    if (line.length > 60 && !looksLikeRoleHeader(line)) {
      result.summary += (result.summary ? "\n" : "") + line;
    }
    // Role-like headers = experience
    else if (looksLikeRoleHeader(line)) {
      result.work_experience += (result.work_experience ? "\n" : "") + line;
    }
  }

  // ── PHASE 6: Fallback detection for missing sections ──────────
  if (!result.work_experience) {
    const expCandidates = lines.filter(
      (l) => (looksLikeRoleHeader(l) || /^[•▪*\-]/.test(l)) && !contactSet.has(l.toLowerCase().trim()),
    );
    if (expCandidates.length >= 2) result.work_experience = expCandidates.join("\n");
  }

  if (!result.skills) {
    const skillCandidates = lines.filter((l) => {
      if (contactSet.has(l.toLowerCase().trim())) return false;
      if (looksLikeRoleHeader(l)) return false;
      return /(excel|power bi|sql|python|react|typescript|javascript|java|oracle|aws|azure|network|communication|leadership|problem solving|docker|kubernetes|git|agile|scrum|إكسل|باور بي آي|sql|oracle|تحليل|إدارة|قيادة|شبكات|برمجة)/i.test(
        l,
      );
    });
    if (skillCandidates.length) result.skills = uniqueLines(skillCandidates).join("\n");
  }

  if (!result.languages) {
    const langCandidates = lines.filter((l) => {
      if (contactSet.has(l.toLowerCase().trim())) return false;
      return /(arabic|english|urdu|french|hindi|spanish|german|chinese|mandarin|العربية|الانجليزية|الإنجليزية|فرنسي|أردو|هندي)/i.test(
        l,
      );
    });
    if (langCandidates.length) result.languages = uniqueLines(langCandidates).join("\n");
  }

  if (!result.education) {
    const eduCandidates = lines.filter((l) => {
      if (contactSet.has(l.toLowerCase().trim())) return false;
      return /(Bachelor|Master|Diploma|PhD|University|College|degree|graduated|بكالوريوس|ماجستير|دبلوم|جامعة|كلية|تخرج)/i.test(
        l,
      );
    });
    if (eduCandidates.length) result.education = uniqueLines(eduCandidates).join("\n");
  }

  const processed = postProcessStructured(result);

  console.log(
    `[extract-text] Final result: name="${processed.full_name}", title="${processed.job_title}", contact_items=${splitLines(processed.contact_info).length}, exp_blocks=${processed.work_experience.split(/\n{2,}/).filter(Boolean).length}, skills_count=${splitLines(processed.skills).length}`,
  );

  return processed;
}

// ── Main handler (deterministic only — NO AI) ───────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      file = formData.get("file") as File;
    } else {
      throw new Error("Please upload a file using multipart/form-data");
    }

    if (!file) throw new Error("No file provided");

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileName = file.name?.toLowerCase() || "";
    const fileType = file.type || "";

    let text = "";

    if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
      text = await extractPDFText(Buffer.from(arrayBuffer));
    } else if (
      fileName.endsWith(".docx") ||
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await extractDOCXText(uint8Array);
    } else {
      text = new TextDecoder("utf-8", { fatal: false }).decode(uint8Array);
    }

    text = cleanArtifacts(
      text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n"),
    );

    const language = detectLanguage(text);
    const { quality, score } = evaluateQuality(text, uint8Array.length);
    const isOcrNeeded = text.length < 20 && uint8Array.length > 10000;

    let structured: StructuredResume = { ...EMPTY_STRUCTURED };
    if (!isOcrNeeded && text.length > 20) {
      structured = heuristicSectionDetection(text, language);
    }

    const experienceLevel = detectExperienceLevel(text, structured);

    const detectedSkills = structured.skills
      .split("\n")
      .map((s) => s.replace(/^[•▪*\-]\s*/, "").trim())
      .filter(Boolean)
      .join(", ");

    return new Response(
      JSON.stringify({
        text: text.substring(0, 50000),
        language,
        quality: isOcrNeeded ? "ocr_needed" : quality,
        quality_score: isOcrNeeded ? 0 : score,
        ocr_needed: isOcrNeeded,
        ai_normalized: false,
        structured,
        detected_job_title: structured.job_title || null,
        detected_skills: detectedSkills || null,
        detected_experience_level: experienceLevel,
        char_count: text.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
