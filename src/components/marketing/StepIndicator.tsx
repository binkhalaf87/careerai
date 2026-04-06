import { CheckCircle, Circle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Step {
  label: string;
  completed: boolean;
  active: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
}

const StepIndicator = ({ steps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          {i > 0 && <div className={`w-6 h-px ${step.completed || step.active ? "bg-primary" : "bg-border"}`} />}
          <div className="flex items-center gap-1.5">
            {step.completed ? (
              <CheckCircle size={16} className="text-primary" />
            ) : (
              <Circle size={16} className={step.active ? "text-primary" : "text-muted-foreground/40"} />
            )}
            <span className={`text-xs font-display font-medium whitespace-nowrap ${
              step.active ? "text-primary" : step.completed ? "text-foreground" : "text-muted-foreground/60"
            }`}>
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
