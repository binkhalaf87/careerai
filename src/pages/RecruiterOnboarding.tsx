import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const RecruiterOnboarding = () => {
  const { user } = useAuth();
  const { refetch } = useAccountType();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: companyName.trim(),
        job_title: jobTitle.trim() || null,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(ar ? "حدث خطأ" : "Something went wrong");
      return;
    }
    await refetch();
    navigate("/recruiter/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir={ar ? "rtl" : "ltr"}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <h1 className="mt-6 text-xl font-display font-bold text-foreground">
            {ar ? "أكمل ملفك كمسؤول توظيف" : "Complete Your Recruiter Profile"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {ar ? "أخبرنا عن شركتك للبدء" : "Tell us about your company to get started"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 block">
              {ar ? "اسم الشركة" : "Company Name"} *
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={ar ? "مثال: شركة ABC" : "e.g. Acme Corp"}
              required
              className="bg-card"
            />
          </div>
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 block">
              {ar ? "المسمى الوظيفي" : "Your Job Title"}
            </label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={ar ? "مثال: مدير الموارد البشرية" : "e.g. HR Manager"}
              className="bg-card"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving || !companyName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {ar ? "ابدأ الآن" : "Get Started"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default RecruiterOnboarding;
