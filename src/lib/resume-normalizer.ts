import { EMPTY_STRUCTURED, StructuredResume, cleanArtifacts } from "./resume-utils";

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

export type LegacyNormalizedResume = StructuredResume & {
  jobTitle: string;
  email: string;
  phone: string;
  linkedin: string;
};

const SECTION_PATTERNS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
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

function normalizeLine(line: string): string {
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
  const v = normalizeLine(line);
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

function isLikelySectionHeading(line: string): SectionKey | null {
  const normalized = normalizeHeadingText(line);
  if (!normalized) return null;

  for (const item of SECTION_PATTERNS) {
    if (item.patterns.some((rx) => rx.test(normalized))) {
      return item.key;
    }
  }

  return null;
}

function splitRawText(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter((line) => !isNoise(line));
}

function looksLikeContact(line: string): boolean {
  return (
    /@/.test(line) ||
    /\+?\d[\d\s\-()]{6,}/.test(line) ||
    /linkedin|github|portfolio|riyadh|jeddah|saudi arabia|ksa|السعودية|الرياض|جدة|phone|email|mobile|tel/i.test(line)
  );
}

function looksLikeName(line: string): boolean {
  if (!line) return false;
  if (line.length > 60) return false;
  if (looksLikeContact(line)) return false;
  if (isLikelySectionHeading(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  return /^[A-Za-z\u0600-\u06FF\s.'-]+$/.test(line);
}

function looksLikeJobTitle(line: string): boolean {
  if (!line) return false;
  if (line.length > 80) return false;
  if (looksLikeContact(line)) return false;
  if (isLikelySectionHeading(line)) return false;

  return /engineer|manager|specialist|supervisor|analyst|developer|consultant|officer|lead|director|support|technician|coordinator|assistant|administrator|architect|designer|executive|مهندس|مدير|أخصائي|مشرف|محلل|مطور|استشاري|فني|منسق|مساعد|مسؤول|مصمم|قائد/i.test(
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
    const currentIsHeading = !!isLikelySectionHeading(line);
    const prevEndsSoftly = /[,;/:\-–—]$/.test(prev) || prev.length < 55;
    const currentLooksContinuation =
      !/^[•▪◦*-]/.test(line) &&
      !looksLikeContact(line) &&
      !looksLikeName(line) &&
      !looksLikeJobTitle(line) &&
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
    if (!target[key]) {
      target[key] = clean;
    } else if (!target[key].includes(clean)) {
      target[key] = `${target[key]}\n${clean}`;
    }
    return;
  }

  const current = cleanArtifacts(target[key] || "").trim();
  target[key] = current ? `${current}\n${clean}` : clean;
}

function inferHeader(lines: string[], target: StructuredResume) {
  const top = lines.slice(0, 8);

  for (const line of top) {
    if (!target.name && looksLikeName(line)) {
      target.name = line;
      continue;
    }

    if (!target.job_title && looksLikeJobTitle(line)) {
      target.job_title = line;
      continue;
    }

    if (looksLikeContact(line)) {
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
      if (/^[•▪◦*-]\s*/.test(line)) return `• ${line.replace(/^[•▪◦*-]\s*/, "").trim()}`;
      if (line.length <= 120) return `• ${line}`;
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(text: string): string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractPhone(text: string): string {
  const match = text.match(/(?:\+966\s*5\d{8}|966\s*5\d{8}|05\d{8}|5\d{8})/) || text.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  return match?.[0]?.trim() || "";
}

function extractLinkedIn(text: string): string {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%/]+/i);
  return match?.[0] || "";
}

function cleanupSectionText(key: SectionKey, value: string): string {
  let text = cleanArtifacts(value).trim();
  if (!text) return "";

  if (key === "contact") {
    const contactLines = text
      .split("\n")
      .map((x) => cleanArtifacts(x))
      .filter(Boolean);

    const unique = [...new Set(contactLines)];
    return unique.join("\n");
  }

  if (key === "skills" || key === "certifications" || key === "projects" || key === "languages") {
    text = normalizeBullets(text);
    const items = text
      .split("\n")
      .map((l) => l.replace(/^•\s*/, "").trim())
      .filter(Boolean);

    return [...new Set(items)].join("\n");
  }

  if (key === "experience" || key === "education") {
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  return text;
}

export function parseResumeTextRobust(rawText: string): StructuredResume {
  const result: StructuredResume = { ...EMPTY_STRUCTURED };

  if (!rawText?.trim()) return result;

  const lines = mergeWrappedLines(splitRawText(rawText));
  inferHeader(lines, result);

  let currentSection: SectionKey | null = null;

  for (const line of lines) {
    const heading = isLikelySectionHeading(line);

    if (heading) {
      currentSection = heading;
      continue;
    }

    if (!result.contact && looksLikeContact(line)) {
      appendSectionValue(result, "contact", line);
      continue;
    }

    if (!result.name && looksLikeName(line)) {
      appendSectionValue(result, "name", line);
      continue;
    }

    if (!result.job_title && looksLikeJobTitle(line)) {
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

    if (
      /excel|power bi|sql|python|react|javascript|java|oracle|aws|azure|docker|git|إكسل|باور بي آي|تحليل|قيادة|شبكات|برمجة/i.test(
        line,
      )
    ) {
      appendSectionValue(result, "skills", line);
      continue;
    }

    if (
      /arabic|english|urdu|french|hindi|spanish|german|chinese|العربية|الانجليزية|الإنجليزية|فرنسي|أردو|هندي/i.test(
        line,
      )
    ) {
      appendSectionValue(result, "languages", line);
      continue;
    }

    if (
      /bachelor|master|diploma|phd|university|college|degree|graduated|بكالوريوس|ماجستير|دبلوم|جامعة|كلية|تخرج/i.test(
        line,
      )
    ) {
      appendSectionValue(result, "education", line);
      continue;
    }
  }

  (Object.keys(result) as SectionKey[]).forEach((key) => {
    result[key] = cleanupSectionText(key, result[key] || "");
  });

  return result;
}

/**
 * Backward-compatible alias for older code paths.
 * Returns StructuredResume + legacy flat aliases expected by useUserResume.ts
 */
export function normalizeResume(rawText: string): LegacyNormalizedResume {
  const structured = parseResumeTextRobust(rawText);

  const contactBlob = structured.contact || "";
  const email = extractEmail(contactBlob);
  const phone = extractPhone(contactBlob);
  const linkedin = extractLinkedIn(contactBlob);

  return {
    ...structured,
    jobTitle: structured.job_title,
    email,
    phone,
    linkedin,
  };
}


