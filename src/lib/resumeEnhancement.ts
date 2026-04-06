import { supabase } from "@/integrations/supabase/client";
import type {
  ImproveResumeRequest,
  ImproveResumeResponse,
  ResumeSection,
} from "@/types/resume";

function normalizeSectionContent(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

export function buildFullResumeFromSections(sections: ResumeSection[]): string {
  return sections
    .filter((section) => section.content?.trim())
    .map((section) => `${section.title}\n${normalizeSectionContent(section.content)}`)
    .join("\n\n");
}

export async function improveResume(
  payload: ImproveResumeRequest,
): Promise<ImproveResumeResponse> {
  const cleanPayload: ImproveResumeRequest = {
    ...payload,
    sections: payload.sections.map((section) => ({
      ...section,
      content: normalizeSectionContent(section.content),
    })),
    fullResumeText:
      payload.fullResumeText?.trim() || buildFullResumeFromSections(payload.sections),
  };

  const { data, error } = await supabase.functions.invoke("improve-resume", {
    body: cleanPayload,
  });

  if (error) {
    throw new Error(error.message || "Failed to improve resume");
  }

  if (!data?.success) {
    throw new Error(data?.message || "Resume improvement failed");
  }

  return data as ImproveResumeResponse;
}
