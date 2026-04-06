// =============================
// TALENTRY ATS ENGINE (v1)
// =============================

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
  };
  issues: Issue[];
  quickImprovements: string[];
};

// =============================
// Helpers
// =============================

const isEmpty = (v?: string) => !v || v.trim().length === 0;

const wordCount = (text?: string) => (text ? text.trim().split(/\s+/).length : 0);

// =============================
// Keywords (IT Support baseline)
// =============================

const KEYWORDS = [
  "technical support",
  "troubleshooting",
  "sql",
  "ticket",
  "incident",
  "sla",
  "support",
  "network",
  "system",
  "user",
];

// =============================
// Main Function
// =============================

export function analyzeResumeATS(resume: StructuredResume): AtsAnalysis {
  let completeness = 0;
  let keywords = 0;
  let readability = 0;
  let structure = 0;
  let impact = 0;

  const issues: Issue[] = [];

  // =============================
  // COMPLETENESS
  // =============================

  const fields = [
    resume.fullName,
    resume.jobTitle,
    resume.professionalSummary,
    resume.workExperience,
    resume.skills,
    resume.education,
  ];

  const filled = fields.filter((f) => !isEmpty(f)).length;
  completeness = Math.round((filled / fields.length) * 100);

  if (completeness < 70) {
    issues.push({
      code: "MISSING_SECTIONS",
      title: "نقص في أقسام السيرة",
      severity: "high",
      section: "general",
      suggestion: "أكمل جميع الأقسام الأساسية مثل الخبرة والمهارات",
    });
  }

  // =============================
  // KEYWORDS
  // =============================

  const allText = Object.values(resume).join(" ").toLowerCase();

  let found = 0;
  KEYWORDS.forEach((k) => {
    if (allText.includes(k)) found++;
  });

  keywords = Math.round((found / KEYWORDS.length) * 100);

  if (keywords < 40) {
    issues.push({
      code: "LOW_KEYWORDS",
      title: "ضعف الكلمات المفتاحية",
      severity: "high",
      section: "skills",
      suggestion: "أضف كلمات مثل troubleshooting, SQL, SLA",
    });
  }

  // =============================
  // READABILITY
  // =============================

  const summaryWords = wordCount(resume.professionalSummary);

  if (summaryWords >= 30 && summaryWords <= 120) {
    readability = 90;
  } else {
    readability = 50;

    issues.push({
      code: "BAD_SUMMARY",
      title: "ملخص مهني غير مناسب",
      severity: "medium",
      section: "summary",
      suggestion: "اجعل الملخص بين 30 إلى 120 كلمة",
    });
  }

  // =============================
  // STRUCTURE
  // =============================

  structure = 80;

  if (isEmpty(resume.jobTitle)) {
    structure -= 30;
    issues.push({
      code: "MISSING_TITLE",
      title: "المسمى الوظيفي غير موجود",
      severity: "high",
      section: "header",
      suggestion: "أضف Job Title واضح",
    });
  }

  // =============================
  // IMPACT
  // =============================

  const hasNumbers = /\d/.test(resume.workExperience || "");

  if (hasNumbers) {
    impact = 90;
  } else {
    impact = 40;

    issues.push({
      code: "NO_IMPACT",
      title: "لا يوجد إنجازات رقمية",
      severity: "high",
      section: "experience",
      suggestion: "أضف أرقام مثل عدد التذاكر أو نسبة التحسن",
    });
  }

  // =============================
  // FINAL SCORE
  // =============================

  const overallScore = Math.round((completeness + keywords + readability + structure + impact) / 5);

  return {
    overallScore,
    breakdown: {
      completeness,
      keywords,
      readability,
      structure,
      impact,
    },
    issues,
    quickImprovements: issues.map((i) => i.suggestion),
  };
}
