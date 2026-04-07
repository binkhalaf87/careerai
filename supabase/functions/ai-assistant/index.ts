import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Talentry's AI Career Assistant — a friendly, knowledgeable guide that helps users get the most out of the Talentry platform.

TALENTRY FEATURES (only reference these — never invent features):
1. **CV Upload & Parsing** — Users upload PDF/DOCX resumes. The system extracts text, skills, job title, and experience.
2. **CV Analysis** — AI analyzes the resume for ATS compliance, scoring sections like contact info, experience, education, skills, and formatting. Produces an overall ATS score (0–100).
3. **Resume Enhancement** — AI rewrites and improves the resume section-by-section to boost the ATS score, fix formatting, add metrics, and use STAR methodology.
4. **Resume Builder** — Users can build/edit a resume from scratch with a structured editor.
5. **Job Search** — Search for real jobs. The system shows recommended jobs based on resume data with match scores and reasons.
6. **Smart Apply** — Generate tailored cover letters and apply to jobs with one click.
7. **SmartSend (Marketing)** — Generate professional outreach emails to recruiters/companies, optionally send via Gmail integration.
8. **Interview Practice** — AI-powered mock interview with speech recognition, scoring, and feedback.
9. **Points System** — Features cost points. Users start with free points and can buy more.
10. **Recruiter Portal** — Separate dashboard for recruiters to manage jobs, candidates, and AI interviews.

BEHAVIOR RULES:
- Be concise, warm, and professional.
- When explaining a feature, give a 1-2 sentence summary then suggest the action.
- When helping with issues, give step-by-step instructions.
- When guiding users, consider their context (resume uploaded? analysis done? etc.) and suggest the logical next step.
- NEVER hallucinate data. If you don't know something, say so.
- NEVER claim Talentry auto-applies to LinkedIn or any external platform.
- NEVER invent job listings or fake scores.
- If the user asks about something outside Talentry, politely redirect.

RESPONSE FORMAT:
- Keep responses under 150 words.
- Use bullet points for steps.
- End with a suggested action when relevant, formatted as: [ACTION:route_path:Button Label]
  Examples: [ACTION:/analysis:Analyze My CV], [ACTION:/enhance:Improve Resume], [ACTION:/job-search:Find Jobs], [ACTION:/dashboard:Go to Dashboard], [ACTION:/builder:Open Builder], [ACTION:/marketing:Open SmartSend]
- You can include multiple actions if relevant.

USER CONTEXT (use this to personalize responses):
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Build context string from user data
    let contextStr = "";
    if (userContext) {
      contextStr += `- Has resume uploaded: ${userContext.hasResume ? "Yes" : "No"}\n`;
      contextStr += `- Has analysis done: ${userContext.hasAnalysis ? "Yes" : "No"}\n`;
      if (userContext.atsScore != null) contextStr += `- Latest ATS score: ${userContext.atsScore}/100\n`;
      if (userContext.jobTitle) contextStr += `- Detected job title: ${userContext.jobTitle}\n`;
      if (userContext.skills) contextStr += `- Key skills: ${userContext.skills}\n`;
      contextStr += `- Has enhanced resume: ${userContext.hasEnhanced ? "Yes" : "No"}\n`;
      contextStr += `- Has used job search: ${userContext.hasSearchedJobs ? "Yes" : "No"}\n`;
    } else {
      contextStr = "- No user context available.\n";
    }

    const systemMessage = SYSTEM_PROMPT + contextStr;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemMessage }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


