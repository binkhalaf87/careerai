import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { rawText, language } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const langInstruction =
      language === "ar" ? "Respond in Arabic. Preserve Arabic text exactly as-is." : "Respond in English.";

    const systemPrompt = `You are an expert resume parser. Extract structured data from raw resume text. ${langInstruction}

RULES:
- Do NOT invent any information. Only extract what exists in the text.
- If a section is missing or unclear, return "missing_information" for that field.
- Preserve the original language of the content.
- Clean up noisy extraction artifacts (broken words, layout characters).
- Detect if the resume is in Arabic, English, or mixed.`;

    const userPrompt = `Parse this raw resume text into structured sections.

Raw text:
${rawText}

Return structured JSON only.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_structured_resume",
              description: "Submit the structured resume data extracted from raw text",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Candidate full name or 'missing_information'" },
                  job_title: { type: "string", description: "Current or target job title or 'missing_information'" },
                  contact_info: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      phone: { type: "string" },
                      location: { type: "string" },
                      linkedin: { type: "string" },
                    },
                    required: ["email", "phone"],
                    additionalProperties: false,
                  },
                  summary: { type: "string", description: "Professional summary or 'missing_information'" },
                  work_experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company: { type: "string" },
                        title: { type: "string" },
                        duration: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["company", "title"],
                      additionalProperties: false,
                    },
                  },
                  skills: { type: "array", items: { type: "string" } },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        institution: { type: "string" },
                        degree: { type: "string" },
                        year: { type: "string" },
                      },
                      required: ["institution", "degree"],
                      additionalProperties: false,
                    },
                  },
                  certifications: { type: "array", items: { type: "string" } },
                  projects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["name"],
                      additionalProperties: false,
                    },
                  },
                  languages: { type: "array", items: { type: "string" } },
                  detected_language: { type: "string", enum: ["en", "ar", "mixed"] },
                },
                required: ["full_name", "contact_info", "detected_language"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_structured_resume" } },
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
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
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
    if (!toolCall?.function?.arguments) throw new Error("No structured data returned from AI");

    const structured =
      typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("normalize-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


