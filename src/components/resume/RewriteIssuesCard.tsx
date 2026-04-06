interface RewriteIssuesCardProps {
  analysis?: {
    weaknesses?: string[] | null;
    suggestions?: string[] | null;
    full_analysis?: Record<string, unknown> | null;
  } | null;
}

export default function RewriteIssuesCard({ analysis }: RewriteIssuesCardProps) {
  const issues = Array.isArray(analysis?.weaknesses) ? analysis!.weaknesses!.filter(Boolean) : [];
  const suggestions = Array.isArray(analysis?.suggestions) ? analysis!.suggestions!.filter(Boolean) : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Detected issues</h3>
        <p className="text-sm text-muted-foreground">
          The rewrite should directly fix the weak areas from the analysis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Weaknesses</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {issues.length > 0 ? (
              issues.map((issue, idx) => <li key={idx}>• {issue}</li>)
            ) : (
              <li>• No weaknesses found</li>
            )}
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Recommended fixes</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {suggestions.length > 0 ? (
              suggestions.map((item, idx) => <li key={idx}>• {item}</li>)
            ) : (
              <li>• Add stronger summary, role keywords, and measurable achievements.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
