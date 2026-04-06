import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuestionCategory = "hr" | "professional";

export interface InterviewQuestion {
  question: string;
  suggested_answer_direction?: string;
  category?: QuestionCategory;
}

export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  improvements: string[];
  ideal_answer: string;
  confidence_assessment: string;
  relevance_assessment: string;
}

export interface InterviewAnswer {
  questionIndex: number;
  questionText: string;
  transcript: string;
  evaluation: AnswerEvaluation | null;
}

export type InterviewStatus = "ready" | "speaking" | "listening" | "evaluating" | "completed";

interface SessionRow {
  id: string;
}

interface UseInterviewSessionReturn {
  status: InterviewStatus;
  currentQuestionIndex: number;
  answers: InterviewAnswer[];
  sessionId: string | null;
  isEvaluating: boolean;
  startSession: (params: {
    userId: string;
    resumeId?: string;
    analysisId?: string;
    jobTitle?: string;
    questions: InterviewQuestion[];
  }) => Promise<void>;
  submitAnswer: (
    transcript: string,
    jobTitle?: string,
    cvSummary?: string,
    language?: string,
  ) => Promise<AnswerEvaluation | null>;
  nextQuestion: () => void;
  endSession: () => Promise<void>;
  questions: InterviewQuestion[];
  overallScore: number | null;
}

export function useInterviewSession(): UseInterviewSessionReturn {
  const [status, setStatus] = useState<InterviewStatus>("ready");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [overallScore, setOverallScore] = useState<number | null>(null);

  const startSession = useCallback(
    async (params: {
      userId: string;
      resumeId?: string;
      analysisId?: string;
      jobTitle?: string;
      questions: InterviewQuestion[];
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("interview_sessions")
        .insert({
          user_id: params.userId,
          resume_id: params.resumeId || null,
          analysis_id: params.analysisId || null,
          job_title: params.jobTitle || "General",
          session_title: `Interview - ${params.jobTitle || "General"}`,
        })
        .select("id")
        .single();

      if (error) throw error;
      setSessionId((data as SessionRow).id);
      setQuestions(params.questions);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setStatus("ready");
      setOverallScore(null);
    },
    [],
  );

  const submitAnswer = useCallback(
    async (transcript: string, jobTitle?: string, cvSummary?: string, language?: string) => {
      if (!sessionId || currentQuestionIndex >= questions.length) return null;

      setIsEvaluating(true);
      setStatus("evaluating");

      const currentQ = questions[currentQuestionIndex];

      try {
        const { data, error } = await supabase.functions.invoke("evaluate-interview-answer", {
          body: {
            job_title: jobTitle,
            cv_summary: cvSummary,
            question: currentQ.question,
            transcript,
            language,
          },
        });

        if (error) throw error;

        const evaluation = data as AnswerEvaluation;

        // Guard against false 0 scores — if the AI returns score=0 but there was actual content, set minimum 1
        if (evaluation.score === 0 && transcript.trim().length > 10) {
          evaluation.score = 1;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("interview_session_answers").insert({
          session_id: sessionId,
          question_order: currentQuestionIndex + 1,
          question_text: currentQ.question,
          transcript_text: transcript,
          score: evaluation.score,
          strengths_json: evaluation.strengths || [],
          improvements_json: evaluation.improvements || [],
          ideal_answer: evaluation.ideal_answer || "",
          confidence_assessment: evaluation.confidence_assessment || "",
          relevance_assessment: evaluation.relevance_assessment || "",
        });

        const newAnswer: InterviewAnswer = {
          questionIndex: currentQuestionIndex,
          questionText: currentQ.question,
          transcript,
          evaluation,
        };

        setAnswers((prev) => [...prev, newAnswer]);
        setIsEvaluating(false);
        setStatus("ready");
        return evaluation;
      } catch (e) {
        console.error("Evaluation error:", e);
        // Return a fallback evaluation instead of null to prevent false 0-score display
        const fallbackEval: AnswerEvaluation = {
          score: -1,
          strengths: [],
          improvements: [typeof e === "object" && e && "message" in e ? (e as Error).message : "Evaluation failed"],
          ideal_answer: "",
          confidence_assessment: "Could not evaluate — please try again.",
          relevance_assessment: "",
        };
        const newAnswer: InterviewAnswer = {
          questionIndex: currentQuestionIndex,
          questionText: currentQ.question,
          transcript,
          evaluation: fallbackEval,
        };
        setAnswers((prev) => [...prev, newAnswer]);
        setIsEvaluating(false);
        setStatus("ready");
        return fallbackEval;
      }
    },
    [sessionId, currentQuestionIndex, questions],
  );

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setStatus("ready");
    } else {
      setStatus("completed");
    }
  }, [currentQuestionIndex, questions.length]);

  const endSession = useCallback(async () => {
    if (!sessionId || answers.length === 0) return;

    const scores = answers.filter((a) => a.evaluation).map((a) => a.evaluation!.score);
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    setOverallScore(avg);

    const summary = {
      total_questions: questions.length,
      answered: answers.length,
      average_score: Math.round(avg * 10) / 10,
      strongest: answers.reduce(
        (best, a) => (!best || (a.evaluation?.score ?? 0) > (best.evaluation?.score ?? 0) ? a : best),
        answers[0],
      )?.questionText,
      weakest: answers.reduce(
        (worst, a) => (!worst || (a.evaluation?.score ?? 0) < (worst.evaluation?.score ?? 0) ? a : worst),
        answers[0],
      )?.questionText,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("interview_sessions")
      .update({ overall_score: avg, summary_json: summary })
      .eq("id", sessionId);

    setStatus("completed");
  }, [sessionId, answers, questions.length]);

  return {
    status,
    currentQuestionIndex,
    answers,
    sessionId,
    isEvaluating,
    startSession,
    submitAnswer,
    nextQuestion,
    endSession,
    questions,
    overallScore,
  };
}


