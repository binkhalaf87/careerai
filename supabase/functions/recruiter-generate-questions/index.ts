import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const toolSchema = {
  type: "function" as const,
  function: {
    name: "submit_questions",
    description: "Return structured interview questions for the candidate.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["hr", "behavioral", "technical", "cv_clarification", "red_flag"],
                description: "Question category",
              },
              question: { type: "string", description: "The interview question" },
              why_it_matters: { type: "string", description: "Why this question is important" },
              strong_answer_signals: { type: "string", description: "What a strong answer looks like" },
            },
            required: ["category", "question", "why_it_matters", "strong_answer_signals"],
          },
          description: "12-18 interview questions across all categories",
        },
      },
      required: ["questions"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { candidateText, candidateName, candidateTitle, language } = await req.json();
    if (!candidateText) {
      return new Response(JSON.stringify({ error: "Missing candidateText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const lang = language === "ar" ? "Arabic" : "English";
    const systemPrompt = `You are a senior interviewer and hiring expert. Generate targeted interview questions based on a candidate's CV. Respond in ${lang}.

Generate questions in these categories:
1. HR/General (2-3 questions)
2. Behavioral (3-4 questions) 
3. Technical/Functional (3-4 questions)
4. CV Clarification (2-3 questions about specific CV items)
5. Red Flag Follow-up (1-2 questions about gaps or concerns)

RULES:
- Questions must be based on the actual CV content
- Include why each question matters
- Include what strong answers look like
- Be specific, not generic`;

    const userPrompt = `Generate interview questions for this candidate.

Name: ${candidateName || "Unknown"}
Title: ${candidateTitle || "Not specified"}

CV Content:
${candidateText.substring(0, 6000)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429)
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (status === 402)
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error(`AI gateway error: ${status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ questions: parsed.questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recruiter-generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


