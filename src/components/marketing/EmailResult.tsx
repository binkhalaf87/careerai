import { useState } from "react";
import { Mail, Copy, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface GeneratedEmail {
  subject: string;
  body: string;
  cover_letter?: string;
  signature?: string;
}

interface EmailResultProps {
  generated: GeneratedEmail;
  emailLang: string;
  onSave: () => void;
}

const EmailResult = ({ generated, emailLang, onSave }: EmailResultProps) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const dir = emailLang === "ar" ? "rtl" : "ltr";

  const handleCopy = () => {
    const text = `${t.marketing.subject}: ${generated.subject}\n\n${generated.body}${generated.signature ? `\n\n${generated.signature}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 bg-card rounded-xl border border-border space-y-4">
      <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
        <Mail size={18} className="text-primary" />
        {t.marketing.generatedEmail}
      </h2>

      <div>
        <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.marketing.subject}</label>
        <div className="p-3 bg-background rounded-lg border border-border text-sm font-body text-foreground" dir={dir}>
          {generated.subject}
        </div>
      </div>

      <div>
        <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.marketing.body}</label>
        <div className="p-3 bg-background rounded-lg border border-border text-sm font-body text-foreground whitespace-pre-wrap" dir={dir}>
          {generated.body}
        </div>
      </div>

      {generated.signature && (
        <div>
          <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.marketing.signatureLabel}</label>
          <div className="p-3 bg-background rounded-lg border border-border text-sm font-body text-foreground whitespace-pre-wrap" dir={dir}>
            {generated.signature}
          </div>
        </div>
      )}

      {generated.cover_letter && (
        <div>
          <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.marketing.coverLetterLabel}</label>
          <div className="p-3 bg-background rounded-lg border border-border text-sm font-body text-foreground whitespace-pre-wrap" dir={dir}>
            {generated.cover_letter}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="outline" className="flex-1">
          {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
          {copied ? t.marketing.copied : t.marketing.copyToClipboard}
        </Button>
        <Button onClick={onSave} className="flex-1">
          <Save size={16} className="mr-2" />
          {t.marketing.save}
        </Button>
      </div>
    </div>
  );
};

export default EmailResult;
