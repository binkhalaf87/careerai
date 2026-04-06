import { Mail, Phone, MapPin, Linkedin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ContactInfoCardProps {
  contact: string;
  name: string;
  jobTitle: string;
  isRTL?: boolean;
  t: (en: string, ar: string) => string;
}

function parseContactFields(contact: string) {
  const fields: { email?: string; phone?: string; location?: string; linkedin?: string } = {};
  const lines = contact.split(/[\n,|•]/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/[\w.-]+@[\w.-]+\.\w+/.test(line)) fields.email = line.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || line;
    else if (/(\+?\d[\d\s\-()]{6,})/.test(line)) fields.phone = line.match(/(\+?\d[\d\s\-()]{6,})/)?.[0]?.trim() || line;
    else if (/linkedin/i.test(line)) fields.linkedin = line;
    else if (!fields.location) fields.location = line;
  }
  return fields;
}

const ContactInfoCard = ({ contact, name, jobTitle, isRTL, t }: ContactInfoCardProps) => {
  const fields = parseContactFields(contact);
  const hasAnyField = fields.email || fields.phone || fields.location || fields.linkedin;

  if (!hasAnyField && !name && !jobTitle) return null;

  return (
    <Card className="mb-4 border-border">
      <CardContent className="p-4">
        <div className="flex flex-col gap-1 mb-3">
          {name && <h3 className="text-lg font-bold text-foreground font-display">{name}</h3>}
          {jobTitle && <p className="text-sm text-muted-foreground">{jobTitle}</p>}
        </div>
        {hasAnyField && (
          <div className="flex flex-wrap gap-3 text-sm">
            {fields.email && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>{fields.email}</span>
              </span>
            )}
            {fields.phone && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span dir="ltr">{fields.phone}</span>
              </span>
            )}
            {fields.location && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>{fields.location}</span>
              </span>
            )}
            {fields.linkedin && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Linkedin className="w-3.5 h-3.5 text-primary" />
                <span className="truncate max-w-[200px]">{fields.linkedin}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContactInfoCard;
