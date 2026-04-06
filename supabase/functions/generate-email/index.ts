import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      jobTitle,
      industry,
      companyName,
      language,
      tone,
      resumeContext,
      profileContext,
      analysisContext,
      recipientEmail,
      recruiterName,
    } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langInstruction =
      language === "ar"
        ? "اكتب الرسالة وخطاب التقديم باللغة العربية الفصحى. استخدم أسلوباً مهنياً ورسمياً."
        : "Write the email and cover letter in English. Use a professional tone.";

    const toneInstruction =
      tone === "confident"
        ? "Use a confident, assertive tone that highlights achievements and unique value."
        : tone === "concise"
          ? "Keep the email brief and to the point, no more than 5 sentences in the body."
          : "Use a formal, polite, and professional tone.";

    const companyLine = companyName ? `Target company: ${companyName}` : "No specific company mentioned.";
    const recruiterLine = recruiterName ? `Recruiter/Hiring manager name: ${recruiterName}` : "";
    const recipientLine = recipientEmail ? `Recipient email: ${recipientEmail}` : "";

    const analysisSection = analysisContext
      ? `\n\nCANDIDATE ANALYSIS INSIGHTS (use these to personalize the email):\n${analysisContext}`
      : "";

    const systemPrompt = `You are an expert career consultant, professional email writer, and cover letter specialist with deep knowledge of the global job market. ${langInstruction} ${toneInstruction}

Your goal is to create a highly personalized, compelling job application that reflects the candidate's actual strengths and experience. Never generate generic content. Every sentence must be backed by the candidate's real data.`;

    const userPrompt = `Generate a job application email AND a short cover letter for the following:
- Job title: ${jobTitle}
- Industry: ${industry}
- ${companyLine}
${recruiterLine}
${recipientLine}
${profileContext || ""}
${resumeContext || ""}
${analysisSection}

INSTRUCTIONS:
1. The email subject must be compelling and specific to the role
2. The email body must be concise, professional, and reference specific candidate strengths
3. The cover letter must be a focused 3-4 paragraph version highlighting key qualifications
4. The signature block must include the candidate's name, contact info if available
5. If analysis data is provided, use the candidate's top strengths and role alignment insights
6. Address the recruiter by name if provided
7. Reference the company specifically if provided

Return the result using the generate_email tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Return the generated job application email, cover letter, and signature.",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Full email body with greeting" },
                  cover_letter: { type: "string", description: "Short 3-4 paragraph cover letter version" },
                  signature: { type: "string", description: "Professional email signature block" },
                },
                required: ["subject", "body", "cover_letter", "signature"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


