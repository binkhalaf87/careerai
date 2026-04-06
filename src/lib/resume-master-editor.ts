import { StructuredResume, EMPTY_STRUCTURED, cleanArtifacts } from "./resume-utils";

const SECTION_ORDER: (keyof StructuredResume)[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
];

const SECTION_ALIASES: Record<string, keyof StructuredResume> = {
  summary: "summary",
  professionalsummary: "summary",
  "professional summary": "summary",
  profile: "summary",

  experience: "experience",
  workexperience: "experience",
  "work experience": "experience",
  employment: "experience",

  skills: "skills",
  keyskills: "skills",
  "key skills": "skills",
  competencies: "skills",

  education: "education",
  academic: "education",
  academics: "education",

  certifications: "certifications",
  certification: "certifications",
  certificates: "certifications",

  projects: "projects",
  project: "projects",

  languages: "languages",
  language: "languages",
};

function normalizeHeadingKey(raw: string): keyof StructuredResume | null {
  const cleaned = raw
    .replace(/[:：]/g, "")
    .replace(/[#*_`>-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const compact = cleaned.replace(/\s+/g, "");

  return SECTION_ALIASES[cleaned] || SECTION_ALIASES[compact] || null;
}

function sectionTitle(key: keyof StructuredResume, lang: "ar" | "en" = "en") {
  const titles = {
    summary: { en: "SUMMARY", ar: "الملخص المهني" },
    experience: { en: "EXPERIENCE", ar: "الخبرات العملية" },
    skills: { en: "SKILLS", ar: "المهارات" },
    education: { en: "EDUCATION", ar: "التعليم" },
    certifications: { en: "CERTIFICATIONS", ar: "الشهادات" },
    projects: { en: "PROJECTS", ar: "المشاريع" },
    languages: { en: "LANGUAGES", ar: "اللغات" },
    name: { en: "NAME", ar: "الاسم" },
    job_title: { en: "JOB TITLE", ar: "المسمى الوظيفي" },
    contact: { en: "CONTACT", ar: "معلومات التواصل" },
  };

  return titles[key][lang];
}

export function buildMasterResumeText(data: StructuredResume, lang: "ar" | "en" = "en"): string {
  const output: string[] = [];

  for (const key of SECTION_ORDER) {
    const content = cleanArtifacts(data[key] || "").trim();
    if (!content) continue;
    output.push(`## ${sectionTitle(key, lang)}\n${content}`);
  }

  return output.join("\n\n");
}

export function parseMasterResumeText(text: string): Partial<StructuredResume> {
  const result: Partial<StructuredResume> = {};

  if (!text?.trim()) return result;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const regex = /^##\s+(.+?)\n([\s\S]*?)(?=^##\s+.+$\n?|$)/gm;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const rawTitle = match[1]?.trim() || "";
    const body = (match[2] || "").trim();
    const key = normalizeHeadingKey(rawTitle);

    if (!key || !body) continue;
    result[key] = cleanArtifacts(body);
  }

  return result;
}

export function buildStructuredFromMasterText(
  masterText: string,
  base?: Partial<StructuredResume>,
): StructuredResume {
  const parsed = parseMasterResumeText(masterText);

  return {
    ...EMPTY_STRUCTURED,
    ...(base || {}),
    ...parsed,
  };
}

export function updateSectionInMaster(
  master: string,
  section: keyof StructuredResume,
  newContent: string,
  lang: "ar" | "en" = "en",
): string {
  if (!SECTION_ORDER.includes(section)) return master;

  const sections = buildStructuredFromMasterText(master);
  sections[section] = cleanArtifacts(newContent).trim();

  return buildMasterResumeText(sections, lang);
}

export function getSectionFromMaster(master: string, section: keyof StructuredResume): string {
  const sections = parseMasterResumeText(master);
  return cleanArtifacts(sections[section] || "");
}