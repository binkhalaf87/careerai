export type StructuredResume = {
  fullName?: string;
  jobTitle?: string;
  contactInfo?: string;
  professionalSummary?: string;
  workExperience?: string;
  skills?: string;
  education?: string;
  certifications?: string;
  projects?: string;
  languages?: string;
};

type Issue = {
  code: string;
  title: string;
  severity: "high" | "medium" | "low";
  section: string;
  suggestion: string;
};

export type AtsAnalysis = {
  overallScore: number;
  breakdown: {
    completeness: number;
    keywords: number;
    readability: number;
    structure: number;
    impact: number;
    summary: number;
    skills: number;
    experience: number;
    education: number;
    formatting: number;
  };
  issues: Issue[];
  quickImprovements: string[];
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  improvements: Array<{ title: string; action: string; priority: "high" | "medium" | "low" }>;
};

const SECTION_KEYS: Array<keyof StructuredResume> = [
  "fullName",
  "jobTitle",
  "contactInfo",
  "professionalSummary",
  "workExperience",
  "skills",
  "education",
  "certifications",
];

const GLOBAL_KEYWORDS = [
  "leadership",
  "communication",
  "problem solving",
  "teamwork",
  "project management",
  "analysis",
  "reporting",
  "stakeholder",
  "customer service",
  "operations",
  "quality",
  "training",
  "strategy",
  "planning",
  "compliance",
  "excel",
  "power bi",
  "sql",
  "python",
  "aws",
  "azure",
  "linux",
  "network",
  "support",
  "troubleshooting",
  "sla",
  "incident",
  "security",
  "automation",
  "crm",
  "erp",
  "oracle",
  "sap",
  "sales",
  "recruitment",
  "saudization",
  "hrsd",
];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const clean = (value?: string) => String(value || "").replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
const lineCount = (value?: string) => clean(value).split(/\n+/).filter(Boolean).length;
const wordCount = (value?: string) => clean(value).split(/\s+/).filter(Boolean).length;
const hasValue = (value?: string) => clean(value).length > 0;
const splitList = (value?: string) =>
  clean(value)
    .split(/\n|,|•|\||;/)
    .map((item) => item.trim())
    .filter(Boolean);

function tokenize(text: string): string[] {
  return clean(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff+#./ -]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function inferKeywords(resume: StructuredResume): string[] {
  const titleTokens = tokenize(`${resume.jobTitle || ""} ${resume.professionalSummary || ""}`)
    .filter((token) => !["with", "from", "that", "this", "have", "years", "year", "for", "and", "the"].includes(token));
  const skillTokens = splitList(resume.skills).flatMap((item) => tokenize(item));
  return unique([...titleTokens, ...skillTokens, ...GLOBAL_KEYWORDS]).slice(0, 60);
}

function countKeywordCoverage(text: string, keywords: string[]): { score: number; missing: string[]; found: string[] } {
  const haystack = clean(text).toLowerCase();
  const found = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  const missing = keywords.filter((keyword) => !haystack.includes(keyword.toLowerCase()));
  const score = keywords.length ? (found.length / keywords.length) * 100 : 0;
  return { score: clamp(score), missing: unique(missing).slice(0, 12), found: unique(found).slice(0, 20) };
}

function scoreCompleteness(resume: StructuredResume) {
  const filled = SECTION_KEYS.filter((key) => hasValue(resume[key])).length;
  const ratio = filled / SECTION_KEYS.length;
  return clamp(ratio * 100);
}

function scoreSkills(resume: StructuredResume) {
  const skills = splitList(resume.skills);
  if (!skills.length) return 20;
  const uniqueSkills = unique(skills.map((item) => item.toLowerCase()));
  const diversityBoost = Math.min(20, uniqueSkills.length * 3);
  const groupedBoost = /tools|platform|framework|database|methodolog|cloud|network|مهارات|أدوات|تقنيات/i.test(resume.skills || "") ? 12 : 0;
  return clamp(35 + diversityBoost + groupedBoost);
}

function scoreExperience(resume: StructuredResume) {
  const text = clean(resume.workExperience);
  if (!text) return 15;
  const bullets = splitList(text).length;
  const dates = (text.match(/(19|20)\d{2}|present|current|حتى الآن|الآن/gi) || []).length;
  const verbs = (text.match(/managed|led|delivered|implemented|supported|improved|developed|reduced|increased|built|created|supervised|optimized|managed|حللت|قدت|طورت|نفذت|دعمت|رفعت|خفضت|أدرت/gi) || []).length;
  return clamp(30 + Math.min(25, bullets * 4) + Math.min(20, dates * 4) + Math.min(25, verbs * 3));
}

function scoreAchievements(resume: StructuredResume) {
  const text = clean(resume.workExperience);
  if (!text) return 10;
  const numberHits = (text.match(/\d+[%+]?|\bSAR\b|\bSLA\b|\bKPI\b|\bMTTR\b|\b24\/7\b/gi) || []).length;
  const impactHits = (text.match(/improved|reduced|increased|saved|achieved|delivered|resolved|optimized|boosted|raised|خفض|رفع|حقق|طوّر|سرّع|حلّ/gi) || []).length;
  return clamp(20 + Math.min(45, numberHits * 8) + Math.min(35, impactHits * 5));
}

function scoreFormatting(resume: StructuredResume) {
  const raw = Object.values(resume).map(clean).filter(Boolean).join("\n");
  if (!raw) return 20;
  const longLinesPenalty = raw
    .split(/\n+/)
    .filter((line) => line.length > 180).length * 6;
  const missingContactPenalty = hasValue(resume.contactInfo) ? 0 : 15;
  const structureBoost = hasValue(resume.jobTitle) && hasValue(resume.professionalSummary) && hasValue(resume.workExperience) ? 18 : 0;
  const bulletBoost = /•|-\s|▪|◦/.test(raw) ? 12 : 0;
  return clamp(70 + structureBoost + bulletBoost - longLinesPenalty - missingContactPenalty);
}

function scoreSummary(resume: StructuredResume) {
  const summary = clean(resume.professionalSummary);
  if (!summary) return 15;
  const words = wordCount(summary);
  const balancedLength = words >= 25 && words <= 90 ? 55 : words >= 15 && words <= 120 ? 40 : 20;
  const titleAlignment = hasValue(resume.jobTitle) && summary.toLowerCase().includes(clean(resume.jobTitle).toLowerCase()) ? 20 : 8;
  const valueLanguage = /(experience|specialist|manager|engineer|support|analysis|operations|compliance|achiev|deliver|impact|خبرة|أخصائي|مدير|مهندس|دعم|تحليل|تشغيل|امتثال|إنجاز)/i.test(summary)
    ? 20
    : 8;
  return clamp(balancedLength + titleAlignment + valueLanguage);
}

export function analyzeResumeATS(resume: StructuredResume): AtsAnalysis {
  const allText = Object.values(resume).map(clean).filter(Boolean).join("\n");
  const keywords = inferKeywords(resume);
  const keywordCoverage = countKeywordCoverage(allText, keywords);

  const completeness = scoreCompleteness(resume);
  const skills = scoreSkills(resume);
  const experience = scoreExperience(resume);
  const impact = scoreAchievements(resume);
  const formatting = scoreFormatting(resume);
  const summary = scoreSummary(resume);
  const education = hasValue(resume.education) ? clamp(65 + Math.min(25, lineCount(resume.education) * 8)) : 20;
  const readability = clamp((formatting + summary) / 2);
  const structure = clamp((completeness + formatting) / 2);

  const overallScore = clamp(
    completeness * 0.2 +
      skills * 0.2 +
      experience * 0.15 +
      impact * 0.15 +
      keywordCoverage.score * 0.15 +
      formatting * 0.1 +
      summary * 0.05,
  );

  const issues: Issue[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvements: AtsAnalysis["improvements"] = [];

  const addIssue = (code: string, title: string, severity: Issue["severity"], section: string, suggestion: string) => {
    issues.push({ code, title, severity, section, suggestion });
    weaknesses.push(title);
    improvements.push({
      title,
      action: suggestion,
      priority: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
    });
  };

  if (completeness >= 80) strengths.push("Core resume sections are present and easy to identify.");
  if (skills >= 70) strengths.push("Skills coverage is reasonably broad and relevant.");
  if (experience >= 70) strengths.push("Experience entries show decent role clarity and progression.");
  if (impact >= 65) strengths.push("There are measurable or outcome-oriented signals in the experience section.");
  if (keywordCoverage.score >= 60) strengths.push("Keyword coverage is aligned with the candidate's target profile.");
  if (summary >= 70) strengths.push("The professional summary gives a clear first impression.");

  if (completeness < 70) {
    addIssue("MISSING_SECTIONS", "Important resume sections are incomplete or missing.", "high", "general", "Complete the missing core sections: summary, experience, skills, education, and contact details.");
  }
  if (skills < 60) {
    addIssue("WEAK_SKILLS", "Skills section is too thin or not well grouped.", "high", "skills", "Add 8-15 relevant skills and group them by tools, platforms, or domain expertise.");
  }
  if (experience < 60) {
    addIssue("WEAK_EXPERIENCE", "Experience section lacks clear role scope and progression.", "high", "experience", "Rewrite experience bullets with role, scope, tools, and outcomes for each position.");
  }
  if (impact < 55) {
    addIssue("LOW_IMPACT", "Achievements are not measurable enough.", "high", "experience", "Add numbers, percentages, SLAs, volumes, timelines, or business outcomes to each major role.");
  }
  if (keywordCoverage.score < 55) {
    addIssue("LOW_KEYWORDS", "Keyword coverage is weak for ATS filtering.", "medium", "keywords", `Add missing role-relevant keywords such as: ${keywordCoverage.missing.slice(0, 6).join(", ")}.`);
  }
  if (formatting < 65) {
    addIssue("FORMATTING", "Formatting/readability can be improved.", "medium", "formatting", "Use clean headings, concise bullets, and avoid dense paragraphs or broken lines.");
  }
  if (summary < 60) {
    addIssue("SUMMARY", "Professional summary is weak or too generic.", "medium", "summary", "Write a 3-5 line summary with title, years of experience, core strengths, and target value.");
  }
  if (education < 50) {
    addIssue("EDUCATION", "Education or certifications are underrepresented.", "low", "education", "State the degree, institution, graduation year, and relevant certifications clearly.");
  }

  while (strengths.length < 3) {
    strengths.push(
      [
        "Candidate profile shows a usable foundation that can be strengthened with targeted edits.",
        "The resume contains enough material to build a stronger ATS-ready version.",
        "There is identifiable role direction, but the presentation needs sharper positioning.",
      ][strengths.length],
    );
  }

  const dedupedImprovements = unique(
    improvements.map((item) => JSON.stringify(item)),
  ).map((item) => JSON.parse(item) as AtsAnalysis["improvements"][number]);

  while (dedupedImprovements.length < 5) {
    dedupedImprovements.push({
      title: "Refine role targeting",
      action: "Align the headline, summary, and keyword selection to one clear target role.",
      priority: "medium",
    });
  }

  const missingKeywords = keywordCoverage.missing.length
    ? keywordCoverage.missing
    : ["leadership", "analysis", "reporting", "operations", "stakeholder management"].filter(
        (keyword) => !clean(allText).toLowerCase().includes(keyword),
      );

  return {
    overallScore,
    breakdown: {
      completeness,
      keywords: keywordCoverage.score,
      readability,
      structure,
      impact,
      summary,
      skills,
      experience,
      education,
      formatting,
    },
    issues,
    quickImprovements: dedupedImprovements.map((item) => item.action),
    strengths: unique(strengths).slice(0, 6),
    weaknesses: unique(weaknesses).slice(0, 6),
    missingKeywords: unique(missingKeywords).slice(0, 12),
    improvements: dedupedImprovements.slice(0, 8),
  };
}
