import { CheckCircle2 } from "lucide-react";
import { useCareerFlow, FLOW_STEPS, type FlowStep } from "@/contexts/CareerFlowContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<FlowStep, { en: string; ar: string }> = {
  upload: { en: "Upload Resume", ar: "رفع السيرة" },
  extract: { en: "Review Resume", ar: "مراجعة السيرة" },
  analyze: { en: "Analyze Resume", ar: "تحليل السيرة" },
  enhance: { en: "Improve Resume", ar: "تحسين السيرة" },
  export: { en: "Prepare Resume", ar: "تجهيز السيرة" },
  jobs: { en: "Jobs", ar: "الوظائف" },
  interview: { en: "Interview", ar: "المقابلة" },
};

function isStepCompleted(step: FlowStep, state: ReturnType<typeof useCareerFlow>["state"]): boolean {
  const map: Record<FlowStep, boolean> = {
    upload: !!state.resumeId,
    extract: state.extractionConfirmed,
    analyze: state.analysisCompleted,
    enhance: state.enhancementCompleted,
    export: state.exportCompleted,
    jobs: state.jobSearchUsed,
    interview: state.interviewUsed,
  };
  return map[step];
}

interface FlowProgressBarProps {
  activeStep: FlowStep;
  className?: string;
}

export default function FlowProgressBar({ activeStep, className }: FlowProgressBarProps) {
  const { state } = useCareerFlow();
  const { language } = useLanguage();
  const ar = language === "ar";
  const activeIdx = FLOW_STEPS.indexOf(activeStep);

  return (
    <div className={cn("w-full bg-card border-b border-border", className)}>
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1" dir={ar ? "rtl" : "ltr"}>
          {FLOW_STEPS.map((step, i) => {
            const completed = isStepCompleted(step, state);
            const active = step === activeStep;
            const upcoming = i > activeIdx && !completed;

            return (
              <div key={step} className="flex items-center gap-1 shrink-0">
                {i > 0 && (
                  <div
                    className={cn(
                      "w-4 sm:w-6 h-px transition-colors",
                      completed ? "bg-primary" : active ? "bg-primary/40" : "bg-border",
                    )}
                  />
                )}
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium font-display transition-all",
                    active && "bg-primary/10 text-primary ring-1 ring-primary/20",
                    completed && !active && "text-primary",
                    upcoming && "text-muted-foreground/50",
                  )}
                >
                  {completed ? (
                    <CheckCircle2 size={14} className="text-primary shrink-0" />
                  ) : (
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded-full border-2 shrink-0",
                        active ? "border-primary bg-primary/20" : "border-current",
                      )}
                    />
                  )}
                  <span className="hidden sm:inline whitespace-nowrap">
                    {ar ? STEP_LABELS[step].ar : STEP_LABELS[step].en}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
