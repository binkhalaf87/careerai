/**
 * TALENTRY — StartInterviewButton.tsx
 *
 * Reusable button that:
 *  1. Creates an interview session (or reuses one)
 *  2. Generates a unique invite link when needed
 *  3. Sends invitation email through Gmail integration in send mode
 *  4. Navigates to the internal interview flow in internal mode
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface StartInterviewButtonProps {
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
  extractedText?: string | null;
  currentTitle?: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
  jobDescription?: string | null;
  mode?: "internal" | "send";
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

type InterviewQuestion = {
  category: string;
  question: string;
  why_it_matters: string;
  strong_answer_signals: string;
};

function randomToken(length = 36) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildInviteEmail(args: {
  ar: boolean;
  candidateName: string;
  interviewLink: string;
  jobTitle?: string | null;
}) {
  const displayName = args.candidateName || (args.ar ? "المرشح" : "Candidate");
  const roleLine = args.jobTitle
    ? args.ar
      ? `للوظيفة: ${args.jobTitle}`
      : `For role: ${args.jobTitle}`
    : "";

  return {
    subject: "AI Interview Invitation – TALENTRY",
    body: `${args.ar ? `مرحباً ${displayName},\n\nتمت دعوتك لإجراء مقابلة ذكية عبر TALENTRY.` : `Hello ${displayName},\n\nYou are invited to complete an AI interview through TALENTRY.`}\n${roleLine ? `${roleLine}\n` : ""}\n${
      args.ar
        ? "الرجاء فتح الرابط التالي وبدء المقابلة في الوقت المناسب لك:"
        : "Please open the link below and complete the interview at your convenience:"
    }\n${args.interviewLink}\n\n${
      args.ar
        ? "ابدأ المقابلة الآن / Start your AI interview now"
        : "Start your AI interview now / ابدأ المقابلة الآن"
    }\n\nTALENTRY`,
  };
}

export function StartInterviewButton({
  candidateId,
  candidateName,
  candidateEmail,
  extractedText,
  currentTitle,
  jobId,
  jobTitle,
  jobDescription,
  mode = "internal",
  size = "sm",
  variant = "default",
  className = "",
}: StartInterviewButtonProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";
  const [loading, setLoading] = useState(false);

  const ensureQuestions = async (): Promise<InterviewQuestion[]> => {
    if (!extractedText?.trim()) return [];

    const { data, error } = await supabase.functions.invoke("recruiter-generate-questions", {
      body: {
        candidateText: extractedText,
        candidateName,
        candidateTitle: currentTitle,
        jobTitle,
        jobDescription,
        language,
      },
    });

    if (error) throw error;
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    return questions.filter(
      (item: any) => item && typeof item.question === "string" && typeof item.category === "string",
    );
  };

  const getExistingSession = async () => {
    const { data } = await supabase
      .from("recruiter_interview_sessions")
      .select("id, status, summary")
      .eq("candidate_id", candidateId)
      .eq("recruiter_id", user!.id)
      .eq("job_id", jobId || null)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    return data?.[0] ?? null;
  };

  const createSession = async (questions: InterviewQuestion[]) => {
    const inviteToken = randomToken(42);
    const summary = {
      invite_token: inviteToken,
      invite_url: null,
      candidate_name: candidateName,
      candidate_email: candidateEmail || null,
      candidate_title: currentTitle || null,
      job_title: jobTitle || null,
      job_description: jobDescription || null,
      sent_via_gmail: false,
    };

    const { data, error } = await supabase
      .from("recruiter_interview_sessions")
      .insert({
        recruiter_id: user!.id,
        candidate_id: candidateId,
        job_id: jobId || null,
        mode: mode === "send" ? "sent_to_candidate" : "internal",
        status: "pending",
        questions,
        answers: [],
        summary,
      })
      .select("id, summary")
      .single();

    if (error || !data) throw error || new Error("Failed to create interview session");

    const finalSummary = {
      ...(data.summary as Record<string, any> | null),
      invite_url: `${window.location.origin}/recruiter/interview/${data.id}`,
    };

    await supabase.from("recruiter_interview_sessions").update({ summary: finalSummary }).eq("id", data.id);
    return { ...data, summary: finalSummary };
  };

  const sendGmailInvite = async (sessionId: string, summary: Record<string, any>) => {
    if (!candidateEmail) {
      throw new Error(ar ? "لا يوجد بريد إلكتروني للمرشح / Candidate email is missing" : "Candidate email is missing / لا يوجد بريد إلكتروني للمرشح");
    }

    const { data: tokenRow } = await supabase.from("gmail_tokens").select("id, gmail_email").eq("user_id", user!.id).maybeSingle();
    if (!tokenRow?.id) {
      throw new Error(ar ? "ربط Gmail مطلوب لإرسال الدعوة / Connect Gmail first" : "Connect Gmail first / ربط Gmail مطلوب لإرسال الدعوة");
    }

    const interviewLink = String(summary?.invite_url || `${window.location.origin}/recruiter/interview/${sessionId}`);
    const email = buildInviteEmail({ ar, candidateName, interviewLink, jobTitle });

    const { error } = await supabase.functions.invoke("gmail-send", {
      body: {
        userId: user!.id,
        to: candidateEmail,
        subject: email.subject,
        body: email.body,
        action: "send",
        saveRecord: false,
      },
    });

    if (error) throw error;

    await supabase
      .from("recruiter_interview_sessions")
      .update({
        summary: {
          ...summary,
          sent_via_gmail: true,
          sent_at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    await supabase.from("recruiter_candidates").update({ stage: "ai_interview_sent" }).eq("id", candidateId);
  };

  const handleClick = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const existing = await getExistingSession();

      if (mode === "internal" && existing?.id) {
        navigate(`/recruiter/interview/${existing.id}`);
        return;
      }

      let sessionId = existing?.id as string | undefined;
      let summary = (existing?.summary as Record<string, any> | null) || null;

      if (!sessionId) {
        if (!extractedText?.trim() && mode === "internal") {
          navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`);
          return;
        }

        toast.info(
          ar
            ? "جارٍ تجهيز أسئلة المقابلة / Preparing interview questions"
            : "Preparing interview questions / جارٍ تجهيز أسئلة المقابلة",
        );
        const questions = await ensureQuestions();
        const session = await createSession(questions);
        sessionId = session.id;
        summary = (session.summary as Record<string, any> | null) || null;
      }

      if (!sessionId) throw new Error("Interview session could not be created");

      if (mode === "send") {
        await sendGmailInvite(sessionId, summary || {});
        toast.success(
          ar
            ? "تم إرسال دعوة المقابلة / AI interview invitation sent"
            : "AI interview invitation sent / تم إرسال دعوة المقابلة",
        );
        return;
      }

      navigate(`/recruiter/interview/${sessionId}`);
    } catch (err: any) {
      toast.error(err?.message || (ar ? "تعذر تنفيذ المقابلة / Interview action failed" : "Interview action failed / تعذر تنفيذ المقابلة"));
    } finally {
      setLoading(false);
    }
  };

  if (mode === "send") {
    return (
      <Button size={size} variant={variant} onClick={handleClick} disabled={loading} className={className}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send size={13} className="mr-1.5" />}
        {ar ? "دعوة مقابلة AI / Send AI Interview" : "Send AI Interview / دعوة مقابلة AI"}
      </Button>
    );
  }

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={loading} className={className}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Brain size={13} className="mr-1.5" />}
      {ar ? "مقابلة AI / Start AI Interview" : "Start AI Interview / مقابلة AI"}
    </Button>
  );
}
