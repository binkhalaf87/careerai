import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const RecruiterReports = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-display font-bold text-foreground">{ar ? "التقارير" : "Reports"}</h1>
      <Card className="p-8 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground font-body">
          {ar ? "تقارير التوظيف والتحليلات ستكون متاحة قريباً" : "Hiring reports and analytics coming soon"}
        </p>
      </Card>
    </div>
  );
};

export default RecruiterReports;
