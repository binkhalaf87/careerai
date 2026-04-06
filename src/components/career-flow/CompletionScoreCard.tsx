import { useCareerFlow, FLOW_STEPS, type FlowStep } from "@/contexts/CareerFlowContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Rocket, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<FlowStep, { en: string; ar: string }> = {
  upload: { en: "Upload Resume", ar: "رفع السيرة الذاتية" },
  extract: { en: "Confirm Extraction", ar: "تأكيد الاستخراج" },
  analyze: { en: "CV Analysis", ar: "تحليل CV" },
  enhance: { en: "Enhance Resume", ar: "تحسين السيرة الذاتية" },
  export: { en: "Export Resume", ar: "تصدير السيرة الذاتية" },
  jobs: { en: "Search Jobs", ar: "بحث عن وظائف" },
  interview: { en: "Practice Interview", ar: "تمرين مقابلة" },
};

function isCompleted(step: FlowStep, state: ReturnType<typeof useCareerFlow>["state"]): boolean {
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

export default function CompletionScoreCard() {
  const { state, completionScore, getNextRoute } = useCareerFlow();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const completedCount = FLOW_STEPS.filter((s) => isCompleted(s, state)).length;

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground font-display">
                {ar ? "رحلتك المهنية" : "Career Journey"}
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                {completedCount}/{FLOW_STEPS.length} {ar ? "خطوات مكتملة" : "steps completed"}
              </p>
            </div>
          </div>
          <div className="text-2xl font-bold font-display text-primary">{completionScore}%</div>
        </div>

        <Progress value={completionScore} className="h-2" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FLOW_STEPS.slice(0, 4).map((step) => {
            const done = isCompleted(step, state);
            return (
              <div
                key={step}
                className={cn(
                  "text-[10px] font-medium font-display px-2 py-1.5 rounded-lg text-center",
                  done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓ " : ""}
                {ar ? STEP_LABELS[step].ar : STEP_LABELS[step].en}
              </div>
            );
          })}
        </div>

        {completionScore < 100 && (
          <Button size="sm" className="w-full gap-2" onClick={() => navigate(getNextRoute())}>
            {ar ? "أكمل الخطوة التالية" : "Continue Next Step"}
            <ArrowRight size={14} className={ar ? "rotate-180" : ""} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
