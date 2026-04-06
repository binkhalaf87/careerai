/**
 * TALENTRY — useInterviewJourney.ts
 *
 * Manages the full AI interview session lifecycle using recruiter_ai_interviews table.
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InterviewMode = "internal" | "sent_to_candidate";

export interface InterviewQuestion {
  category: string;
  question: string;
  why_it_matters: string;
  strong_answer_signals: string;
}

export interface InterviewAnswer {
  question_index: number;
  answer: string;
  score?: number;
  feedback?: string;
}

export interface InterviewSession {
  id: string;
  candidate_id: string;
  job_id: string | null;
  question_set_id: string | null;
  mode: InterviewMode;
  status: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  overall_score: number | null;
  recommendation: string | null;
  strengths: string[] | null;
  weak_answers: string[] | null;
  evaluation_summary: string | null;
  invite_token: string | null;
  created_at: string;
}

export interface CandidateForInterview {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  extracted_text: string | null;
}

export interface JobForInterview {
  id: string;
  title: string;
  description: string | null;
}

// Helper to map recruiter_ai_interviews row to InterviewSession shape
function mapRowToSession(row: any): InterviewSession {
  const summary = (row.summary as any) || {};
  return {
    id: row.id,
    candidate_id: row.candidate_id,
    job_id: summary.job_id ?? null,
    question_set_id: row.question_set_id,
    mode: summary.mode ?? "internal",
    status: row.status,
    questions: Array.isArray(summary.questions) ? summary.questions : [],
    answers: Array.isArray(row.answers) ? (row.answers as InterviewAnswer[]) : [],
    overall_score: row.overall_score,
    recommendation: summary.recommendation ?? null,
    strengths: Array.isArray(summary.strengths) ? summary.strengths : null,
    weak_answers: Array.isArray(summary.weak_answers) ? summary.weak_answers : null,
    evaluation_summary: summary.evaluation_summary ?? null,
    invite_token: row.token ?? null,
    created_at: row.created_at,
  };
}

// ─── Create / load session ────────────────────────────────────────────────────

export function useCreateInterviewSession(recruiterId: string | undefined) {
  const [loading, setLoading] = useState(false);

  const createSession = useCallback(
    async (opts: {
      candidate: CandidateForInterview;
      job?: JobForInterview | null;
      questionSetId?: string | null;
      mode?: InterviewMode;
      language?: string;
    }): Promise<InterviewSession | null> => {
      if (!recruiterId) return null;
      setLoading(true);

      try {
        let questions: InterviewQuestion[] = [];

        if (opts.questionSetId) {
          const { data: qSet } = await supabase
            .from("recruiter_question_sets")
            .select("questions")
            .eq("id", opts.questionSetId)
            .single();
          questions = Array.isArray(qSet?.questions) ? (qSet.questions as unknown as InterviewQuestion[]) : [];
        }

        if (!questions.length && opts.candidate.extracted_text) {
          const { data, error } = await supabase.functions.invoke("recruiter-generate-questions", {
            body: {
              candidateText: opts.candidate.extracted_text,
              candidateName: opts.candidate.name,
              candidateTitle: opts.candidate.current_title,
              jobTitle: opts.job?.title,
              jobDescription: opts.job?.description,
              language: opts.language || "en",
            },
          });
          if (error) throw error;
          questions = data?.questions || [];
        }

        if (!questions.length) {
          toast.error("Could not generate interview questions. Upload a CV first.");
          return null;
        }

        let questionSetId = opts.questionSetId || null;
        if (!questionSetId && questions.length) {
          const { data: savedSet } = await supabase
            .from("recruiter_question_sets")
            .insert({
              recruiter_id: recruiterId,
              candidate_id: opts.candidate.id,
              job_id: opts.job?.id || null,
              title: `${opts.candidate.name} — ${opts.job?.title || "Interview"}`,
              questions: questions as any,
            })
            .select("id")
            .single();
          questionSetId = savedSet?.id || null;
        }

        const { data: session, error: sessionErr } = await supabase
          .from("recruiter_ai_interviews")
          .insert({
            recruiter_id: recruiterId,
            candidate_id: opts.candidate.id,
            question_set_id: questionSetId,
            status: "pending",
            answers: [],
            summary: {
              job_id: opts.job?.id || null,
              mode: opts.mode || "internal",
              questions,
            } as any,
          })
          .select("*")
          .single();

        if (sessionErr) throw sessionErr;

        return mapRowToSession(session);
      } catch (err: any) {
        toast.error(err.message || "Failed to create interview session");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [recruiterId],
  );

  return { createSession, loading };
}

// ─── Submit answers + evaluate ────────────────────────────────────────────────

export function useEvaluateInterview() {
  const [loading, setLoading] = useState(false);

  const evaluate = useCallback(
    async (opts: {
      sessionId: string;
      candidate: CandidateForInterview;
      job?: JobForInterview | null;
      questions: InterviewQuestion[];
      answers: InterviewAnswer[];
      language?: string;
    }): Promise<{
      overall_score: number;
      recommendation: string;
      evaluation_summary: string;
      strengths: string[];
      weak_answers: string[];
      answer_scores: { question_index: number; score: number; feedback: string }[];
    } | null> => {
      setLoading(true);
      try {
        const questionsAndAnswers = opts.questions.map((q, i) => ({
          category: q.category,
          question: q.question,
          answer: opts.answers.find((a) => a.question_index === i)?.answer || "",
        }));

        const { data, error } = await supabase.functions.invoke("evaluate-candidate-interview", {
          body: {
            candidateName: opts.candidate.name,
            candidateTitle: opts.candidate.current_title,
            candidateText: opts.candidate.extracted_text,
            jobTitle: opts.job?.title,
            jobDescription: opts.job?.description,
            questionsAndAnswers,
            language: opts.language || "en",
          },
        });

        if (error) throw error;
        const evaluation = data?.evaluation;
        if (!evaluation) throw new Error("No evaluation returned");

        const scoredAnswers: InterviewAnswer[] = opts.answers.map((a) => {
          const scored = evaluation.answer_scores?.find(
            (s: { question_index: number }) => s.question_index === a.question_index,
          );
          return scored ? { ...a, score: scored.score, feedback: scored.feedback } : a;
        });

        // Fetch existing summary to merge
        const { data: existing } = await supabase
          .from("recruiter_ai_interviews")
          .select("summary")
          .eq("id", opts.sessionId)
          .single();

        const existingSummary = (existing?.summary as any) || {};

        await supabase
          .from("recruiter_ai_interviews")
          .update({
            answers: scoredAnswers as any,
            overall_score: evaluation.overall_score,
            status: "completed",
            completed_at: new Date().toISOString(),
            summary: {
              ...existingSummary,
              recommendation: evaluation.recommendation,
              strengths: evaluation.strengths,
              weak_answers: evaluation.weak_answers,
              evaluation_summary: evaluation.evaluation_summary,
            } as any,
          })
          .eq("id", opts.sessionId);

        await supabase
          .from("recruiter_candidates")
          .update({
            interview_score: evaluation.overall_score,
            interview_recommendation: evaluation.recommendation,
            interview_results: {
              session_id: opts.sessionId,
              overall_score: evaluation.overall_score,
              recommendation: evaluation.recommendation,
              evaluation_summary: evaluation.evaluation_summary,
              strengths: evaluation.strengths,
              weak_answers: evaluation.weak_answers,
              completed_at: new Date().toISOString(),
            },
            stage: "ai_interview_completed",
          })
          .eq("id", opts.candidate.id);

        return {
          ...evaluation,
          answer_scores: scoredAnswers
            .map((a) => ({
              question_index: a.question_index,
              score: a.score ?? 0,
              feedback: a.feedback ?? "",
            }))
            .filter((a) => a.score !== undefined),
        };
      } catch (err: any) {
        toast.error(err.message || "Evaluation failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { evaluate, loading };
}

// ─── Load a session by ID ─────────────────────────────────────────────────────

export function useInterviewSession(sessionId: string | null) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const { data } = await supabase.from("recruiter_ai_interviews").select("*").eq("id", sessionId).single();
    setSession(data ? mapRowToSession(data) : null);
    setLoading(false);
  }, [sessionId]);

  return { session, load, loading };
}

// ─── List sessions for a candidate ───────────────────────────────────────────

export function useCandidateInterviewSessions(candidateId: string | undefined) {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    const { data } = await supabase
      .from("recruiter_ai_interviews")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    setSessions((data || []).map(mapRowToSession));
    setLoading(false);
  }, [candidateId]);

  return { sessions, load, loading };
}
