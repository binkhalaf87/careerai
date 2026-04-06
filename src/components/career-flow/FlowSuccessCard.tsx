import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface FlowSuccessCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  className?: string;
}

export default function FlowSuccessCard({ title, description, ctaLabel, onCta, className }: FlowSuccessCardProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground font-display">{title}</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">{description}</p>
        </div>
        <Button onClick={onCta} className="gap-2 shrink-0">
          {ctaLabel}
          <ArrowRight size={14} className={ar ? "rotate-180" : ""} />
        </Button>
      </CardContent>
    </Card>
  );
}
