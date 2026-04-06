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

export type EnhanceTarget = "it-support" | "help-desk" | "technical-support" | "network-engineer" | "general";

export type EnhanceSection =
  | "professionalSummary"
  | "workExperience"
  | "skills"
  | "education"
  | "certifications"
  | "projects"
  | "languages"
  | "fullResume";

export interface EnhanceIssue {
  code: string;
  title: string;
  severity: "high" | "medium" | "low";
  section: EnhanceSection | "header" | "general";
  suggestion: string;
}

export interface EnhanceContext {
  target?: EnhanceTarget;
  targetTitle?: string;
  keywords?: string[];
  issues?: EnhanceIssue[];
  language?: "ar" | "en";
}

export interface SectionEnhancementPlan {
  section: EnhanceSection;
  currentText: string;
  suggestedKeywords: string[];
  constraints: string[];
  prompt: string;
}

export interface ResumeEnhancementPlan {
  target: EnhanceTarget;
  targetTitle: string;
  sectionPlans: SectionEnhancementPlan[];
  quickWins: string[];
  warningFlags: string[];
}

const TARGET_KEYWORDS: Record<EnhanceTarget, string[]> = {
  "it-support": [
    "technical support",
    "troubleshooting",
    "incident management",
    "ticketing",
    "sla",
    "sql",
    "end-user support",
    "problem resolution",
  ],
  "help-desk": [
    "help desk",
    "ticketing",
    "user support",
    "incident resolution",
    "customer support",
    "service desk",
    "sla",
  ],
  "technical-support": [
    "technical support",
    "issue resolution",
    "system support",
    "user training",
    "ticketing",
    "service improvement",
    "sql",
  ],
  "network-engineer": [
    "network troubleshooting",
    "routing",
    "switching",
    "ospf",
    "bgp",
    "incident management",
    "network operations",
  ],
  general: ["results-driven", "problem solving", "communication", "collaboration", "process improvement"],
};

const TARGET_TITLES: Record<EnhanceTarget, string> = {
  "it-support": "IT Support Specialist",
  "help-desk": "Help Desk Specialist",
  "technical-support": "Technical Support Specialist",
  "network-engineer": "Network Engineer",
  general: "Professional Resume",
};

function normalizeText(value?: string): string {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectTarget(resume: StructuredResume, ctx?: EnhanceContext): EnhanceTarget {
  if (ctx?.target) return ctx.target;
  const text = [resume.jobTitle, resume.professionalSummary, resume.workExperience, resume.skills]
    .join(" ")
    .toLowerCase();

  if (text.includes("network") || text.includes("bgp") || text.includes("ospf")) return "network-engineer";
  if (text.includes("help desk") || text.includes("service desk")) return "help-desk";
  if (text.includes("technical support")) return "technical-support";
  if (text.includes("it support") || text.includes("sql") || text.includes("ticket")) return "it-support";
  return "general";
}

function containsNumbers(text: string): boolean {
  return /\d/.test(text);
}

function countBullets(text: string): number {
  return (text.match(/^[\-•*]/gm) || []).length;
}

function collectQuickWins(resume: StructuredResume, target: EnhanceTarget): string[] {
  const wins: string[] = [];
  const summary = normalizeText(resume.professionalSummary);
  const exp = normalizeText(resume.workExperience);
  const skills = normalizeText(resume.skills);

  if (summary.length < 80) wins.push("Expand the professional summary into 3–4 ATS-friendly lines.");
  if (!containsNumbers(exp))
    wins.push("Add measurable achievements or realistic operational metrics to work experience.");
  if (countBullets(exp) < 3) wins.push("Convert experience into concise bullet points with strong action verbs.");
  if (skills && !skills.toLowerCase().includes("sql") && target !== "general")
    wins.push("Add role-relevant technical keywords naturally inside the skills section.");
  if (!skills) wins.push("Build a stronger skills section grouped by technical and professional competencies.");

  return wins.slice(0, 5);
}

function collectWarnings(resume: StructuredResume): string[] {
  const warnings: string[] = [];
  const exp = normalizeText(resume.workExperience);
  const summary = normalizeText(resume.professionalSummary);

  if (/\[.*?\]/.test(exp) || /\[.*?\]/.test(summary))
    warnings.push("The resume contains placeholder text like [Required] or [confirm]. Remove or replace it.");
  if (/added kpi/i.test(exp))
    warnings.push("Review any recommended KPI text before using it. Do not claim unsupported numbers.");
  if (summary.split(/\s+/).length > 120)
    warnings.push("The professional summary is too long and should be shortened for readability.");

  return warnings;
}

function buildSectionPrompt(
  section: EnhanceSection,
  currentText: string,
  targetTitle: string,
  keywords: string[],
  ctx?: EnhanceContext,
): string {
  const language = ctx?.language || "en";
  const commonRules = [
    "Preserve truthfulness. Do not invent employers, certifications, or achievements.",
    "Use ATS-friendly wording naturally.",
    "Keep formatting clean and readable.",
    "Avoid generic fluff and repetition.",
  ];

  const sectionRuleMap: Record<EnhanceSection, string[]> = {
    professionalSummary: [
      "Write 3-4 lines maximum.",
      "Open with role alignment and years/level if known.",
      "Include 3-5 target keywords naturally.",
    ],
    workExperience: [
      "Rewrite into concise bullet points.",
      "Start bullets with strong action verbs.",
      "Emphasize impact, outcomes, tools, and responsibilities.",
      "Do not invent metrics; if none exist, improve clarity without fake numbers.",
    ],
    skills: [
      "Group skills into clear categories.",
      "Favor searchable ATS keywords over vague phrases.",
      "Keep only relevant skills.",
    ],
    education: ["Keep education concise and structured."],
    certifications: ["List certifications cleanly, one per line or bullet."],
    projects: ["Highlight relevant projects with tools and outcome if available."],
    languages: ["Use concise proficiency labels."],
    fullResume: ["Improve section by section without changing factual meaning."],
  };

  const instructions = [...commonRules, ...sectionRuleMap[section]].map((r) => `- ${r}`).join("\n");
  const kw = keywords.length ? keywords.join(", ") : "None provided";

  if (language === "ar") {
    return [
      `أعد كتابة قسم ${section} لسيرة ذاتية تستهدف وظيفة ${targetTitle}.`,
      "التزم بالقواعد التالية:",
      instructions,
      `الكلمات المفتاحية المستهدفة: ${kw}`,
      "النص الحالي:",
      currentText || "[فارغ]",
      "أعد فقط النص المحسن لهذا القسم بدون شروحات إضافية.",
    ].join("\n\n");
  }

  return [
    `Rewrite the ${section} section for a resume targeting the role: ${targetTitle}.`,
    "Follow these rules:",
    instructions,
    `Target keywords: ${kw}`,
    "Current text:",
    currentText || "[Empty]",
    "Return only the improved section text with no extra commentary.",
  ].join("\n\n");
}

function makePlanForSection(
  section: EnhanceSection,
  text: string,
  targetTitle: string,
  keywords: string[],
  ctx?: EnhanceContext,
): SectionEnhancementPlan {
  const normalized = normalizeText(text);
  const constraints = ["Do not fabricate information.", "Keep meaning truthful.", "Improve ATS keyword relevance."];
  if (section === "professionalSummary") constraints.push("Keep it concise and recruiter-friendly.");
  if (section === "workExperience") constraints.push("Prefer bullet points and impact verbs.");
  if (section === "skills") constraints.push("Remove weak generic skills when possible.");

  return {
    section,
    currentText: normalized,
    suggestedKeywords: keywords,
    constraints,
    prompt: buildSectionPrompt(section, normalized, targetTitle, keywords, ctx),
  };
}

export function buildResumeEnhancementPlan(resume: StructuredResume, context?: EnhanceContext): ResumeEnhancementPlan {
  const target = detectTarget(resume, context);
  const targetTitle = context?.targetTitle || resume.jobTitle || TARGET_TITLES[target];
  const keywords = [...new Set([...(context?.keywords || []), ...TARGET_KEYWORDS[target]])];

  const sectionPlans: SectionEnhancementPlan[] = [
    makePlanForSection("professionalSummary", resume.professionalSummary || "", targetTitle, keywords, context),
    makePlanForSection("workExperience", resume.workExperience || "", targetTitle, keywords, context),
    makePlanForSection("skills", resume.skills || "", targetTitle, keywords, context),
    makePlanForSection("education", resume.education || "", targetTitle, keywords, context),
    makePlanForSection("certifications", resume.certifications || "", targetTitle, keywords, context),
    makePlanForSection("projects", resume.projects || "", targetTitle, keywords, context),
    makePlanForSection("languages", resume.languages || "", targetTitle, keywords, context),
  ];

  return {
    target,
    targetTitle,
    sectionPlans,
    quickWins: collectQuickWins(resume, target),
    warningFlags: collectWarnings(resume),
  };
}

export function buildSingleSectionPrompt(
  resume: StructuredResume,
  section: EnhanceSection,
  context?: EnhanceContext,
): string {
  const plan = buildResumeEnhancementPlan(resume, context);
  return plan.sectionPlans.find((p) => p.section === section)?.prompt || "";
}

export function buildOptimizeAllPrompt(resume: StructuredResume, context?: EnhanceContext): string {
  const plan = buildResumeEnhancementPlan(resume, context);

  return [
    `Target role: ${plan.targetTitle}`,
    `Target keywords: ${plan.sectionPlans[0]?.suggestedKeywords.join(", ") || "None"}`,
    "Optimize the resume section by section.",
    "Rules:",
    "- Preserve truthfulness.",
    "- Do not invent metrics or experiences.",
    "- Use ATS-friendly wording.",
    "- Keep sections distinct and readable.",
    "Return JSON with keys:",
    '{"professionalSummary":"...","workExperience":"...","skills":"...","education":"...","certifications":"...","projects":"...","languages":"..."}',
    "Current resume:",
    JSON.stringify(resume, null, 2),
  ].join("\n\n");
}
