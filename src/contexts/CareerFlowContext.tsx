import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface CareerFlowState {
  resumeId: string | null;
  extractionConfirmed: boolean;
  analysisCompleted: boolean;
  enhancementCompleted: boolean;
  exportCompleted: boolean;
  jobSearchUsed: boolean;
  interviewUsed: boolean;
}

const STORAGE_KEY = "talentry_career_flow";

const DEFAULT_STATE: CareerFlowState = {
  resumeId: null,
  extractionConfirmed: false,
  analysisCompleted: false,
  enhancementCompleted: false,
  exportCompleted: false,
  jobSearchUsed: false,
  interviewUsed: false,
};

export type FlowStep =
  | "upload"
  | "extract"
  | "analyze"
  | "enhance"
  | "export"
  | "jobs"
  | "interview";

export const FLOW_STEPS: FlowStep[] = [
  "upload",
  "extract",
  "analyze",
  "enhance",
  "export",
  "jobs",
  "interview",
];

export const STEP_ROUTES: Record<FlowStep, string> = {
  upload: "/dashboard",
  extract: "/enhance",
  analyze: "/analysis",
  enhance: "/enhance",
  export: "/enhance",
  jobs: "/job-search",
  interview: "/dashboard/interview-avatar",
};

interface CareerFlowContextValue {
  state: CareerFlowState;
  currentStep: FlowStep;
  completionScore: number;
  setResumeId: (id: string) => void;
  markStep: (step: Exclude<FlowStep, "upload">) => void;
  resetFlow: () => void;
  getNextRoute: () => string;
  getRequiredRedirect: (page: FlowStep) => string | null;
}

const CareerFlowContext = createContext<CareerFlowContextValue | null>(null);

function loadState(): CareerFlowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATE;
}

function computeCurrentStep(s: CareerFlowState): FlowStep {
  if (!s.resumeId) return "upload";
  if (!s.extractionConfirmed) return "extract";
  if (!s.analysisCompleted) return "analyze";
  if (!s.enhancementCompleted) return "enhance";
  if (!s.exportCompleted) return "export";
  if (!s.jobSearchUsed) return "jobs";
  if (!s.interviewUsed) return "interview";
  return "interview";
}

function computeScore(s: CareerFlowState): number {
  let score = 0;
  if (s.resumeId) score += 15;
  if (s.extractionConfirmed) score += 15;
  if (s.analysisCompleted) score += 20;
  if (s.enhancementCompleted) score += 20;
  if (s.exportCompleted) score += 10;
  if (s.jobSearchUsed) score += 10;
  if (s.interviewUsed) score += 10;
  return score;
}

export function CareerFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CareerFlowState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setResumeId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, resumeId: id }));
  }, []);

  const markStep = useCallback((step: Exclude<FlowStep, "upload">) => {
    setState((prev) => {
      const map: Record<string, Partial<CareerFlowState>> = {
        extract: { extractionConfirmed: true },
        analyze: { analysisCompleted: true },
        enhance: { enhancementCompleted: true },
        export: { exportCompleted: true },
        jobs: { jobSearchUsed: true },
        interview: { interviewUsed: true },
      };
      return { ...prev, ...map[step] };
    });
  }, []);

  const resetFlow = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const currentStep = computeCurrentStep(state);
  const completionScore = computeScore(state);

  const getNextRoute = useCallback(() => {
    const step = computeCurrentStep(state);
    const route = STEP_ROUTES[step];
    if (state.resumeId && (step === "extract" || step === "enhance" || step === "export")) {
      return `${route}?resume_id=${state.resumeId}`;
    }
    if (state.resumeId && step === "analyze") {
      return `${route}?id=${state.resumeId}`;
    }
    return route;
  }, [state]);

  const getRequiredRedirect = useCallback(
    (page: FlowStep): string | null => {
      if (page === "upload") return null;
      if (!state.resumeId) return "/dashboard";
      if (page === "analyze" && !state.extractionConfirmed) return `/enhance?resume_id=${state.resumeId}`;
      return null;
    },
    [state],
  );

  return (
    <CareerFlowContext.Provider
      value={{
        state,
        currentStep,
        completionScore,
        setResumeId,
        markStep,
        resetFlow,
        getNextRoute,
        getRequiredRedirect,
      }}
    >
      {children}
    </CareerFlowContext.Provider>
  );
}

export function useCareerFlow() {
  const ctx = useContext(CareerFlowContext);
  if (!ctx) throw new Error("useCareerFlow must be used within CareerFlowProvider");
  return ctx;
}
