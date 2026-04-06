import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Linkedin, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeLinkedIn, sanitizeLocation, sanitizePhone } from "@/lib/resume-utils";

interface ParsedContact {
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

export function parseContactString(contact: string): ParsedContact {
  const fields: ParsedContact = { email: "", phone: "", location: "", linkedin: "" };
  const lines = contact
    .split(/[\n|•]/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = sanitizePhone(line);
    const linkedin = sanitizeLinkedIn(line);
    const location = sanitizeLocation(line);

    if (email && !fields.email) fields.email = email;
    else if (phone && !fields.phone) fields.phone = phone;
    else if (linkedin && !fields.linkedin) fields.linkedin = linkedin;
    else if (location && !fields.location) fields.location = location;
  }

  return fields;
}

export function contactFieldsToString(fields: ParsedContact): string {
  return [
    fields.email.trim(),
    sanitizePhone(fields.phone),
    sanitizeLocation(fields.location),
    sanitizeLinkedIn(fields.linkedin),
  ]
    .filter(Boolean)
    .join("\n");
}

interface EditableResumeHeaderProps {
  name: string;
  jobTitle: string;
  contact: string;
  onNameChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onContactChange: (value: string) => void;
  isRTL?: boolean;
  t: (en: string, ar: string) => string;
}

const EditableResumeHeader = ({
  name,
  jobTitle,
  contact,
  onNameChange,
  onJobTitleChange,
  onContactChange,
  isRTL,
  t,
}: EditableResumeHeaderProps) => {
  const parsed = parseContactString(contact);

  const updateContactField = (field: keyof ParsedContact, value: string) => {
    const updated = { ...parsed, [field]: value };
    onContactChange(contactFieldsToString(updated));
  };

  return (
    <Card className="mb-6 border-primary/20 bg-card">
      <CardContent className="p-6 space-y-5">
        {/* Name & Job Title */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="w-4 h-4 text-primary" />
              {t("Full Name", "الاسم الكامل")}
            </Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("e.g. John Doe", "مثال: ماجد الحربي")}
              className={cn("text-lg font-semibold", isRTL && "text-right")}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Briefcase className="w-4 h-4 text-primary" />
              {t("Job Title", "المسمى الوظيفي")}
            </Label>
            <Input
              value={jobTitle}
              onChange={(e) => onJobTitleChange(e.target.value)}
              placeholder={t("e.g. Software Engineer", "مثال: مهندس برمجيات")}
              className={cn(isRTL && "text-right")}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
        </div>

        {/* Contact Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Mail className="w-3.5 h-3.5 text-primary" />
              {t("Email", "البريد الإلكتروني")}
            </Label>
            <Input
              value={parsed.email}
              onChange={(e) => updateContactField("email", e.target.value)}
              placeholder="email@example.com"
              type="email"
              dir="ltr"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Phone className="w-3.5 h-3.5 text-primary" />
              {t("Phone", "الهاتف")}
            </Label>
            <Input
              value={parsed.phone}
              onChange={(e) => updateContactField("phone", e.target.value)}
              placeholder="+966 5XX XXX XXXX"
              dir="ltr"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {t("Location", "الموقع")}
            </Label>
            <Input
              value={parsed.location}
              onChange={(e) => updateContactField("location", e.target.value)}
              placeholder={t("e.g. Riyadh, Saudi Arabia", "مثال: الرياض، السعودية")}
              className={cn("text-sm", isRTL && "text-right")}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Linkedin className="w-3.5 h-3.5 text-primary" />
              LinkedIn
            </Label>
            <Input
              value={parsed.linkedin}
              onChange={(e) => updateContactField("linkedin", e.target.value)}
              placeholder="linkedin.com/in/yourprofile"
              dir="ltr"
              className="text-sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EditableResumeHeader;
