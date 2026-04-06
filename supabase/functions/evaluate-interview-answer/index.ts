import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const toolSchema = {
  type: "function" as const,
  function: {
    name: "submit_evaluation",
    description: "Submit the evaluation of a candidate's interview answer.",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Score from 0 to 10" },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "2-4 strength bullet points",
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          description: "2-4 improvement bullet points",
        },
        ideal_answer: { type: "string", description: "A concise improved professional answer" },
        confidence_assessment: { type: "string", description: "Short sentence about confidence and clarity" },
        relevance_assessment: { type: "string", description: "Short sentence about answer relevance to question" },
      },
      required: ["score", "strengths", "improvements", "ideal_answer", "confidence_assessment", "relevance_assessment"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { job_title, cv_summary, question, transcript, language } = await req.json();

    if (!question || !transcript) {
      return new Response(JSON.stringify({ error: "Missing question or transcript" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language === "ar" ? "Arabic" : "English";

    const systemPrompt = `You are an expert HR interviewer and interview coach with 15+ years of experience.
Evaluate the candidate's answer in a mock interview. Respond in ${lang}.
Be practical, encouraging but honest. Keep feedback actionable and concise.`;

    const userPrompt = `Job Title: ${job_title || "General"}
Candidate CV Summary: ${cv_summary || "Not provided"}
Interview Question: ${question}
Candidate Answer: ${transcript}

Evaluate this answer. Be practical, do not be overly harsh.
Feedback should help the candidate improve.
Keep the ideal answer concise and realistic.
Avoid generic filler.`;

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
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(JSON.stringify({ error: "AI evaluation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No evaluation returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evaluation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-interview-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


