import { useState, useEffect, useCallback } from "react";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeResume } from "@/lib/resume-normalizer";

export interface UserResumeData {
  id: string;
  user_id: string;
  original_file_url: string;
  raw_resume_text: string | null;
  structured_resume_json: Record<string, string> | null;
  detected_job_title: string | null;
  detected_skills: string | null;
  detected_experience_level: string | null;
  resume_id: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeStructured(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const output: Record<string, string> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      output[key] = raw
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .join("\n");
      continue;
    }
    output[key] = String(raw).trim();
  }

  return output;
}

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx"];
const MAX_RESUME_FILE_SIZE = 20 * 1024 * 1024;

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getNormalizedResumeMimeType(file: File): string {
  const ext = getFileExtension(file.name);
  return (
    file.type ||
    (ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  );
}

export function validateResumeFile(file: File): { ext: string; mimeType: string } {
  const ext = getFileExtension(file.name);
  const mimeType = getNormalizedResumeMimeType(file);

  if (!ALLOWED_RESUME_TYPES.includes(file.type) && !ALLOWED_RESUME_EXTENSIONS.includes(ext)) {
    throw new Error("Only PDF and DOCX files are supported");
  }

  if (file.size > MAX_RESUME_FILE_SIZE) {
    throw new Error("File size must be under 20MB");
  }

  if (file.size === 0) {
    throw new Error("File is empty");
  }

  return { ext, mimeType };
}

export function getReadableUploadErrorMessage(message?: string | null, language: "ar" | "en" = "en"): string {
  const fallback = language === "ar" ? "فشل رفع السيرة الذاتية" : "Failed to upload resume";
  const raw = String(message || "").trim();
  if (!raw) return fallback;

  const normalized = raw.toLowerCase();

  if (normalized.includes("only pdf and docx") || normalized.includes("unsupported file type")) {
    return language === "ar" ? "الملفات المدعومة فقط: PDF أو DOCX" : "Only PDF or DOCX files are supported";
  }

  if (normalized.includes("under 20mb")) {
    return language === "ar" ? "حجم الملف يجب أن يكون أقل من 20MB" : "File size must be under 20MB";
  }

  if (normalized.includes("file is empty") || normalized.includes("uploaded file is empty")) {
    return language === "ar" ? "الملف فارغ" : "File is empty";
  }

  if (
    normalized.includes("could not extract enough text") ||
    normalized.includes("scanned") ||
    normalized.includes("image-only") ||
    normalized.includes("not_enough_text")
  ) {
    return language === "ar"
      ? "تعذر استخراج نص كافٍ من الملف. غالبًا الملف صورة أو PDF ممسوح ضوئيًا. ارفع PDF نصي أو ملف DOCX."
      : "Could not extract enough text. The file may be scanned or image-only. Please upload a text-based PDF or DOCX.";
  }

  if (normalized.includes("storage upload failed")) {
    return language === "ar" ? "فشل رفع الملف إلى التخزين" : "Failed to upload the file to storage";
  }

  if (normalized.includes("unsupported content-type") || normalized.includes("missing 'file' field")) {
    return language === "ar" ? "صيغة رفع الملف غير صحيحة" : "Invalid file upload payload";
  }

  if (normalized.includes("text extraction failed")) {
    return language === "ar" ? "فشل استخراج النص من الملف" : "Failed to extract text from the file";
  }

  return raw;
}

export function buildResumeUploadFormData(file: File, mimeType?: string): FormData {
  const normalizedFile =
    mimeType && file.type !== mimeType
      ? new File([file], file.name, { type: mimeType, lastModified: file.lastModified })
      : file;

  const formData = new FormData();
  formData.append("file", normalizedFile, normalizedFile.name);
  return formData;
}

export async function getSupabaseFunctionErrorMessage(
  error: unknown,
  fallback = "Text extraction failed",
): Promise<string> {
  if (!error) return fallback;

  if (error instanceof FunctionsHttpError) {
    try {
      const context = await error.context.json();
      return String(context?.message || context?.error || fallback);
    } catch {
      return error.message || fallback;
    }
  }

  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export function useUserResume(resumeId?: string | null) {
  const { user, loading: authLoading, initialized } = useAuth();
  const [data, setData] = useState<UserResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResume = useCallback(async () => {
    if (!initialized || authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("user_resumes" as never)
        .select("*")
        .eq("user_id", user.id);

      if (resumeId) {
        query = query.eq("resume_id", resumeId);
      }

      const { data: rows, error: fetchError } = await query.order("created_at", { ascending: false }).limit(1);

      if (fetchError) throw fetchError;

      const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as UserResumeData) : null;
      setData(row);
    } catch (err) {
      console.error("[useUserResume] fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load resume data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [initialized, authLoading, user?.id, resumeId]);

  useEffect(() => {
    void fetchResume();
  }, [fetchResume]);

  return { data, loading, error, refetch: fetchResume };
}

async function cleanupUploadedResumeArtifacts(resumeId: string | null, filePath: string) {
  if (resumeId) {
    try {
      await supabase.from("resumes").delete().eq("id", resumeId);
    } catch {
      // ignore cleanup failures
    }
  }

  try {
    await supabase.storage.from("resumes").remove([filePath]);
  } catch {
    // ignore cleanup failures
  }
}

export async function uploadAndParseResume(
  userId: string,
  file: File,
  options?: { onProgress?: (value: number) => void },
): Promise<{ resumeId: string; userResumeId: string; structured: Record<string, string> }> {
  const setProgress = (value: number) => {
    options?.onProgress?.(Math.max(0, Math.min(100, Math.round(value))));
  };

  setProgress(5);

  // ── STEP 1: Validate file type before anything ─────────────────────────
  const { mimeType } = validateResumeFile(file);
  setProgress(12);

  // ── STEP 2: Upload file to Storage ─────────────────────────────────────
  const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = `${userId}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    // FIX: Explicitly set contentType to ensure correct MIME type
    contentType: mimeType,
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }
  setProgress(42);

  // ── STEP 3: Insert resume record ────────────────────────────────────────
  const { data: resumeRow, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      file_name: file.name,
      file_path: filePath,
      file_type: mimeType,
    })
    .select("id")
    .single();

  if (insertError || !resumeRow) {
    // Rollback: remove uploaded file so storage doesn't have orphans
    try {
      await supabase.storage.from("resumes").remove([filePath]);
    } catch {
      /* ignore */
    }
    throw new Error(insertError?.message || "Failed to create resume record");
  }
  setProgress(55);

  // ── STEP 4: Extract text via Edge Function ──────────────────────────────
  // FIX: Supabase invoke() with FormData body must NOT set Content-Type manually
  // The browser sets it automatically with the correct boundary for multipart/form-data
  const formData = buildResumeUploadFormData(file, mimeType);

  const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-text", {
    body: formData,
  });

  if (extractError) {
    const extractionErrorMessage = await getSupabaseFunctionErrorMessage(extractError, "Text extraction failed");
    await cleanupUploadedResumeArtifacts(resumeRow.id, filePath);
    throw new Error(extractionErrorMessage);
  }

  if (extractData?.error) {
    const extractionMessage = String(extractData?.message || extractData?.error || "Text extraction failed");
    console.warn("[uploadAndParseResume] extraction warning:", extractionMessage, extractData?.meta);
    await cleanupUploadedResumeArtifacts(resumeRow.id, filePath);
    throw new Error(extractionMessage);
  }
  setProgress(78);

  // ── STEP 5: Build structured data ──────────────────────────────────────
  const rawText = String(extractData?.text || "");
  const structured = normalizeStructured(extractData?.structured) || {};
  const normalized = normalizeResume(rawText);

  const mergedStructured: Record<string, string> = {
    ...structured,
    name: normalized.name || structured.name || structured.full_name || "",
    full_name: normalized.name || structured.full_name || structured.name || "",
    job_title: normalized.jobTitle || structured.job_title || "",
    email: normalized.email || structured.email || "",
    phone: normalized.phone || structured.phone || "",
    linkedin: normalized.linkedin || structured.linkedin || "",
  };

  const contactParts = [
    normalized.email || structured.email || "",
    normalized.phone || structured.phone || "",
    String(structured.location || structured.address || "").trim(),
    normalized.linkedin || structured.linkedin || "",
  ].filter(Boolean);

  if (contactParts.length) {
    mergedStructured.contact = contactParts.join("\n");
    mergedStructured.contact_info = contactParts.join("\n");
  }

  const detectedLanguage = String(extractData?.language || "en");
  const detectedJobTitle =
    String(normalized.jobTitle || extractData?.detected_job_title || mergedStructured.job_title || "").trim() || null;
  const detectedSkills = String(extractData?.detected_skills || structured.skills || "").trim() || null;
  const detectedExperienceLevel = String(extractData?.detected_experience_level || "").trim() || null;

  // ── STEP 6: Update resume record with extracted text ───────────────────
  await supabase
    .from("resumes")
    .update({
      extracted_text: rawText,
      language: detectedLanguage,
    })
    .eq("id", resumeRow.id);
  setProgress(90);

  // ── STEP 7: Save to user_resumes ────────────────────────────────────────
  const userResumePayload = {
    user_id: userId,
    original_file_url: filePath,
    raw_resume_text: rawText,
    structured_resume_json: mergedStructured,
    detected_job_title: detectedJobTitle,
    detected_skills: detectedSkills,
    detected_experience_level: detectedExperienceLevel,
    resume_id: resumeRow.id,
  };

  const { data: userResumeRow, error: userResumeError } = await supabase
    .from("user_resumes" as never)
    .insert(userResumePayload as never)
    .select("id")
    .single();

  if (userResumeError) {
    console.error("[uploadAndParseResume] user_resumes insert error:", userResumeError);
    // Don't rollback here — the resume was uploaded and parsed successfully
    // user_resumes is supplementary metadata, not critical
    console.warn("[uploadAndParseResume] Continuing despite user_resumes error");
  }

  setProgress(100);

  return {
    resumeId: resumeRow.id,
    userResumeId: String((userResumeRow as { id?: string })?.id || ""),
    structured: mergedStructured,
  };
}

export async function getStoredResumeData(userId: string, resumeId: string): Promise<UserResumeData | null> {
  const { data, error } = await supabase
    .from("user_resumes" as never)
    .select("*")
    .eq("user_id", userId)
    .eq("resume_id", resumeId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[getStoredResumeData] error:", error);
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as UserResumeData;
}
