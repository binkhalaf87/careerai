export type ResumeSectionType =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "languages"
  | "custom";

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: string;
}

export interface ImproveResumeRequest {
  language: "ar" | "en";
  targetJobTitle?: string;
  targetIndustry?: string;
  preserveFormatting?: boolean;
  sections: ResumeSection[];
  fullResumeText?: string;
}

export interface ImprovedResumeSection extends ResumeSection {
  improvedContent: string;
  notes?: string[];
}

export interface ImproveResumeResponse {
  success: boolean;
  improvedFullResume: string;
  sections: ImprovedResumeSection[];
  warnings: string[];
  model: string;
}
