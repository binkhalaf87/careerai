import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildResumeUploadFormData,
  getReadableUploadErrorMessage,
  getSupabaseFunctionErrorMessage,
  validateResumeFile,
} from "@/hooks/useUserResume";
import { generateAndPersistCandidateAnalysis } from "@/hooks/useCandidateAnalysis";
import { triggerMatchCalculation } from "@/hooks/useJobMatches";

export interface BulkUploadItemResult {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "processing" | "analyzing" | "success" | "failed";
  progress: number;
  message?: string;
  candidateId?: string;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\b(cv|resume|curriculum vitae)\b/gi, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeSkills(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,\n•·|]/) : [];

  return [
    ...new Set(
      items
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .map((item) => item.replace(/^[-•*]+\s*/, ""))
        .filter(Boolean),
    ),
  ];
}

function extractExperienceYears(structured: Record<string, any>, rawText: string): number | null {
  const directKeys = [
    "experience_years",
    "years_of_experience",
    "total_experience_years",
    "experience",
    "yearsExperience",
  ];
  for (const key of directKeys) {
    const value = structured?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  const mergedText = [structured?.summary, structured?.experience, rawText].filter(Boolean).join(" \n ");
  const match = mergedText.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|سنوات|سنة|سنه)\b/i);
  if (match) {
    const parsed = parseFloat(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function processSingleFile(args: {
  file: File;
  recruiterId: string;
  language: string;
  autoRunAnalysis: boolean;
  onUpdate: (patch: Partial<BulkUploadItemResult>) => void;
}) {
  let filePath = "";
  let candidateId = "";

  try {
    args.onUpdate({ status: "uploading", progress: 10 });
    const { mimeType } = validateResumeFile(args.file);
    const safeName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    candidateId = crypto.randomUUID();
    filePath = `recruiter/${args.recruiterId}/candidates/${candidateId}/${Date.now()}_${safeName}`;

    const { error: storageErr } = await supabase.storage
      .from("resumes")
      .upload(filePath, args.file, { cacheControl: "3600", upsert: false, contentType: mimeType });
    if (storageErr) throw new Error(storageErr.message || "Storage upload failed");

    args.onUpdate({ status: "processing", progress: 45 });
    const formData = buildResumeUploadFormData(args.file, mimeType);
    const { data: extractData, error: extractErr } = await supabase.functions.invoke("extract-text", {
      body: formData,
    });
    if (extractErr) throw new Error(await getSupabaseFunctionErrorMessage(extractErr, "Text extraction failed"));
    if (extractData?.error)
      throw new Error(String(extractData?.message || extractData?.error || "Text extraction failed"));

    const rawText = String(extractData?.text || "");
    const structured = (extractData?.structured || {}) as Record<string, any>;
    const fallbackEmail =
      String(structured.email || structured.contact_info || structured.contact || rawText || "").match(
        /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
      )?.[0] || null;
    const fallbackPhone =
      String(structured.phone || structured.mobile || rawText || "").match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0] || null;
    const extractedSkills = normalizeSkills(structured.skills || structured.key_skills || structured.technical_skills);
    const extractedExperienceYears = extractExperienceYears(structured, rawText);
    const rawName =
      structured.full_name || structured.name || structured.candidate_name || args.file.name.replace(/\.[^.]+$/, "");
    const name = cleanName(rawName) || args.file.name.replace(/\.[^.]+$/, "");

    const { error: insertErr } = await supabase.from("recruiter_candidates").insert({
      id: candidateId,
      recruiter_id: args.recruiterId,
      name,
      email: structured.email || fallbackEmail,
      phone: structured.phone || fallbackPhone,
      current_title: structured.job_title || structured.current_title || null,
      file_name: args.file.name,
      file_path: filePath,
      extracted_text: rawText,
      structured_data: structured,
      extracted_skills: extractedSkills,
      extracted_experience_years: extractedExperienceYears,
      experience_years: extractedExperienceYears,
      stage: "new",
    } as any);
    if (insertErr) throw new Error(insertErr.message || "Failed to create candidate");

    if (args.autoRunAnalysis && rawText.trim()) {
      args.onUpdate({ status: "analyzing", progress: 82 });
      await generateAndPersistCandidateAnalysis({
        candidateId,
        recruiterId: args.recruiterId,
        resumeId: filePath,
        candidateText: rawText,
        candidateName: name,
        candidateTitle: structured.job_title || structured.current_title || null,
        language: args.language,
        analysisType: "auto_upload",
      });
    }

    await triggerMatchCalculation({ candidate_id: candidateId });
    args.onUpdate({ status: "success", progress: 100, candidateId, message: "Done" });
    return { ok: true, candidateId };
  } catch (error: any) {
    if (filePath) {
      try {
        await supabase.storage.from("resumes").remove([filePath]);
      } catch {}
    }
    if (candidateId) {
      try {
        await supabase.from("recruiter_candidates").delete().eq("id", candidateId).eq("recruiter_id", args.recruiterId);
      } catch {}
    }
    args.onUpdate({
      status: "failed",
      progress: 100,
      message: getReadableUploadErrorMessage(error?.message, args.language as any),
    });
    return { ok: false };
  }
}

export function useBulkCandidateUpload() {
  const [items, setItems] = useState<BulkUploadItemResult[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const uploadFiles = useCallback(
    async (args: { files: File[]; recruiterId: string; language: string; autoRunAnalysis: boolean }) => {
      const selected = args.files.slice(0, 10);
      const unsupported = args.files.filter((file) => !/\.(pdf|docx)$/i.test(file.name));
      if (args.files.length > 10) throw new Error("You can upload up to 10 CV files per batch.");
      if (unsupported.length) throw new Error("Only PDF and DOCX files are supported.");

      if (running) {
        return {
          successCount: items.filter((item) => item.status === "success").length,
          failedCount: items.filter((item) => item.status === "failed").length,
        };
      }

      const nextItems: BulkUploadItemResult[] = selected.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        status: "pending",
        progress: 0,
      }));
      setItems(nextItems);
      setRunning(true);
      setCompleted(false);

      const results = await Promise.all(
        selected.map((file, index) =>
          processSingleFile({
            file,
            recruiterId: args.recruiterId,
            language: args.language,
            autoRunAnalysis: args.autoRunAnalysis,
            onUpdate: (patch) => {
              setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
            },
          }),
        ),
      );

      setRunning(false);
      setCompleted(true);
      return {
        successCount: results.filter((result) => result.ok).length,
        failedCount: results.filter((result) => !result.ok).length,
      };
    },
    [completed, items, running],
  );

  const reset = useCallback(() => {
    setItems([]);
    setRunning(false);
    setCompleted(false);
  }, []);

  return { items, running, completed, uploadFiles, reset };
}


