import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, language } = await req.json();
    if (!text?.trim()) throw new Error("No text provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langInstruction =
      language === "ar"
        ? "أعد صياغة النص باللغة العربية بأسلوب مهني ومتوافق مع أنظمة ATS."
        : "Rephrase in English with a professional ATS-optimized tone.";

    const systemPrompt = `You are an elite resume writer specializing in ATS optimization. ${langInstruction}

ABSOLUTE RULES:
1. ONLY rephrase and improve the provided text.
2. NEVER invent, fabricate, or add information not present in the original.
3. NEVER add fake metrics, percentages, numbers, certifications, or skills.
4. Keep all factual details (names, dates, companies, numbers) unchanged.
5. Use strong action verbs and professional language.
6. Improve clarity and impact without changing meaning.
7. Return ONLY the rephrased text. No explanations, headers, or markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rephrase this text professionally:\n\n${text}` },
        ],
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
    const rephrased = data.choices?.[0]?.message?.content;
    if (!rephrased) throw new Error("No rephrased text returned");

    return new Response(JSON.stringify({ rephrased: rephrased.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rephrase-selection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


