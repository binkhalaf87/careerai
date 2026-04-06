import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  Clock,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Send,
  Wifi,
  CheckCircle2,
  FileText,
  Wand2,
} from "lucide-react";

export type JobStatus = "saved" | "applied" | "prepared";

export interface JobItem {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_city: string;
  job_state: string;
  job_country: string;
  job_employment_type: string;
  job_apply_link: string;
  job_description: string;
  job_posted_at: string;
  job_is_remote: boolean;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;
  job_required_skills: string[];
  job_required_experience_months: number | null;
  job_highlights: { qualifications: string[]; responsibilities: string[] };
  match_score?: number;
  match_reasons?: string[];
}

interface Props {
  job: JobItem;
  isSaved: boolean;
  ar: boolean;
  onSave: (job: JobItem) => void;
  onUnsave: (jobId: string) => void;
  onAutoApply: (job: JobItem) => void;
  gmailConnected: boolean;
  jobStatus?: JobStatus;
  onStatusChange?: (jobId: string, status: JobStatus) => void;
}

const TYPE_MAP: Record<string, string> = {
  FULLTIME: "Full-time",
  PARTTIME: "Part-time",
  CONTRACTOR: "Contract",
  INTERN: "Internship",
};

const STATUS_CONFIG: Record<JobStatus, { label: string; labelAr: string; color: string; icon: typeof Bookmark }> = {
  saved: { label: "Saved", labelAr: "محفوظة", color: "bg-blue-100 text-blue-700 border-blue-200", icon: BookmarkCheck },
  applied: {
    label: "Applied",
    labelAr: "تم التقديم",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  prepared: {
    label: "Prepared",
    labelAr: "جاهز",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: FileText,
  },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function JobCard({
  job,
  isSaved,
  ar,
  onSave,
  onUnsave,
  onAutoApply,
  gmailConnected,
  jobStatus,
  onStatusChange,
}: Props) {
  const location = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");
  const scoreColor =
    (job.match_score ?? 0) >= 80
      ? "text-green-600 bg-green-50 border-green-200"
      : (job.match_score ?? 0) >= 50
        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
        : "text-muted-foreground bg-muted border-muted";

  const statusCfg = jobStatus ? STATUS_CONFIG[jobStatus] : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3">
          {/* Logo */}
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {job.employer_logo ? (
              <img
                src={job.employer_logo}
                alt=""
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground/50" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-tight truncate">{job.job_title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{job.employer_name}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusCfg && StatusIcon && (
                  <Badge variant="outline" className={`text-[10px] font-medium ${statusCfg.color}`}>
                    <StatusIcon size={10} className="mr-0.5" />
                    {ar ? statusCfg.labelAr : statusCfg.label}
                  </Badge>
                )}
                {job.match_score != null && (
                  <Badge variant="outline" className={`text-[10px] font-bold ${scoreColor}`}>
                    {job.match_score}% {ar ? "تطابق" : "Match"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {location}
                </span>
              )}
              {job.job_employment_type && (
                <span className="flex items-center gap-1">
                  <Briefcase size={11} /> {TYPE_MAP[job.job_employment_type] || job.job_employment_type}
                </span>
              )}
              {job.job_is_remote && (
                <span className="flex items-center gap-1 text-primary">
                  <Wifi size={11} /> Remote
                </span>
              )}
              {job.job_posted_at && (
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {timeAgo(job.job_posted_at)}
                </span>
              )}
            </div>

            {/* Skills */}
            {job.job_required_skills?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {job.job_required_skills.slice(0, 5).map((skill, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}

            {/* Salary */}
            {job.job_min_salary && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {job.job_salary_currency || "$"}
                {job.job_min_salary.toLocaleString()}
                {job.job_max_salary ? ` - ${job.job_max_salary.toLocaleString()}` : "+"}
                {job.job_salary_period ? ` / ${job.job_salary_period}` : ""}
              </p>
            )}

            {/* Match Reasons */}
            {job.match_reasons && job.match_reasons.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {job.match_reasons.slice(0, 3).map((reason, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            )}

            {/* Description preview */}
            {job.job_description && !job.match_reasons?.length && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{job.job_description}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button size="sm" className="h-7 text-xs px-3" asChild>
                <a href={job.job_apply_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} className="mr-1" />
                  {ar ? "تقديم" : "Apply"}
                </a>
              </Button>

              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => onAutoApply(job)}>
                <Send size={12} className="mr-1" />
                {ar ? "تقديم تلقائي" : "Auto Apply"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5 border-violet-500/30 text-violet-700 dark:text-violet-400 hover:bg-violet-500/10"
                asChild
              >
                <Link to={`/enhance?job=${encodeURIComponent(job.job_title)}`}>
                  <Wand2 size={12} className="mr-1" />
                  {ar ? "حسّن سيرتك لهذه الوظيفة" : "Improve Resume"}
                </Link>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={() => (isSaved ? onUnsave(job.job_id) : onSave(job))}
              >
                {isSaved ? <BookmarkCheck size={14} className="text-primary" /> : <Bookmark size={14} />}
              </Button>

              {/* Status change buttons (only for saved jobs) */}
              {isSaved && onStatusChange && (
                <div className="flex items-center gap-1 border-l pl-2 ml-1 border-border">
                  {(["saved", "applied", "prepared"] as JobStatus[]).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = jobStatus === s;
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        className={`h-6 text-[10px] px-2 ${active ? cfg.color : ""}`}
                        onClick={() => onStatusChange(job.job_id, s)}
                      >
                        {ar ? cfg.labelAr : cfg.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
