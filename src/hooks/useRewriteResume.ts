import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deductPoints } from "@/lib/points";

interface RewritePayload {
  resume: {
    id?: string;
    raw_resume_text?: string;
    structured_resume_json?: Record<string, unknown> | null;
    corrections?: Record<string, string>;
    detected_job_title?: string | null;
  };
  analysis: Record<string, unknown>;
  userId?: string;
}

export interface RewriteResult {
  rewritten_resume: string;
  improvement_summary: string[];
}

export function useRewriteResume() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rewrite = async ({ resume, analysis, userId }: RewritePayload) => {
    setLoading(true);
    setError(null);

    try {
      // Deduct points first
      if (userId) {
        const pointResult = await deductPoints(userId, "enhancement", "Resume Enhancement");
        if (!pointResult.success) {
          throw new Error(pointResult.error || "Insufficient points");
        }
      }

      // Build the payload the edge function expects
      const targetJobTitle =
        resume.corrections?.title ||
        resume.detected_job_title ||
        (resume.structured_resume_json as Record<string, string>)?.job_title ||
        (resume.structured_resume_json as Record<string, string>)?.jobTitle ||
        (analysis as Record<string, unknown>)?.target_role ||
        "";

      const { data, error: fnError } = await supabase.functions.invoke("rewrite-resume", {
        body: {
          resumeId: resume.id || "unknown",
          resumeText: resume.raw_resume_text || "",
          structuredResume: resume.structured_resume_json || {},
          analysis,
          targetJobTitle: String(targetJobTitle),
        },
      });

      if (fnError) throw fnError;

      const parsed = typeof data === "string" ? JSON.parse(data) : data;

      // Handle error responses from the edge function
      if (parsed?.error && !parsed?.rewritten_resume) {
        throw new Error(parsed.error);
      }

      const normalized: RewriteResult = {
        rewritten_resume: String(
          parsed?.rewritten_resume || parsed?.rewrittenResume || parsed?.full_resume || ""
        ).trim(),
        improvement_summary: Array.isArray(parsed?.improvement_summary)
          ? parsed.improvement_summary.map((item: unknown) => String(item)).filter(Boolean)
          : Array.isArray(parsed?.improvements)
            ? parsed.improvements.map((item: unknown) => String(item)).filter(Boolean)
            : [],
      };

      if (!normalized.rewritten_resume) {
        throw new Error("AI returned an empty resume. Please try again.");
      }

      setResult(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resume rewrite failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { rewrite, result, loading, error, setResult };
}


