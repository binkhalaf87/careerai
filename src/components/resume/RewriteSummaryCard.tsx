import { Badge } from "@/components/ui/badge";

interface RewriteSummaryCardProps {
  resume?: {
    structured_resume_json?: Record<string, string> | null;
    detected_job_title?: string | null;
  } | null;
  analysis?: {
    overall_score?: number | null;
    full_analysis?: Record<string, unknown> | null;
  } | null;
  improvementSummary?: string[];
}

const splitLines = (value?: string | null) =>
  String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function RewriteSummaryCard({ resume, analysis, improvementSummary = [] }: RewriteSummaryCardProps) {
  const structured = resume?.structured_resume_json || {};
  const skills = splitLines(structured.skills || structured.key_skills);
  const experience = splitLines(structured.workExperience || structured.work_experience || structured.experience);
  const targetRole = String(
    (analysis?.full_analysis as { target_role?: string } | null)?.target_role ||
      resume?.detected_job_title ||
      structured.job_title ||
      "",
  ).trim();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enhanced Resume</p>
          <h3 className="text-lg font-bold text-foreground">ATS rewrite context</h3>
          <p className="text-sm text-muted-foreground">
            The rewrite will reuse your extracted resume and the latest analysis results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {targetRole ? <Badge variant="secondary">{targetRole}</Badge> : null}
          {typeof analysis?.overall_score === "number" ? (
            <Badge variant="outline">ATS {analysis.overall_score}</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="text-muted-foreground">Name</div>
          <div className="font-medium">{structured.full_name || structured.name || "-"}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="text-muted-foreground">Title</div>
          <div className="font-medium">{structured.job_title || resume?.detected_job_title || "-"}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="text-muted-foreground">Skills detected</div>
          <div className="font-medium">{skills.length}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="text-muted-foreground">Experience lines</div>
          <div className="font-medium">{experience.length}</div>
        </div>
      </div>

      {improvementSummary.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Improvement goals</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {improvementSummary.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="text-violet-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
