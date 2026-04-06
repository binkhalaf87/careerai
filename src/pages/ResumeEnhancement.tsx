import { Navigate, useSearchParams } from "react-router-dom";

export default function ResumeEnhancement() {
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get("id") || searchParams.get("resume_id") || "";
  const params = new URLSearchParams();
  if (resumeId) params.set("id", resumeId);
  params.set("tab", "enhanced");
  return <Navigate to={`/analysis?${params.toString()}`} replace />;
}
