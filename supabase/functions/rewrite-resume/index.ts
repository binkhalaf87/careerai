import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RewriteResponse = {
  summary?: {
    targetRole?: string;
    atsScoreContext?: string;
    improvements?: string[];
  };
  issues?: {
    weaknesses?: string[];
    recommendedFixes?: string[];
  };
  rewrittenResume?: string;
  rewritten_resume?: string;
  improvement_summary?: string[];
  improvements?: string[];
  weaknesses?: string[];
  recommendedFixes?: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
    }

    if (!lovableApiKey) {
      return jsonResponse({ error: "Missing LOVABLE_API_KEY" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { resumeId, resumeText, structuredResume, analysis, targetJobTitle } = body ?? {};

    if (!resumeId && !resumeText && !structuredResume) {
      return jsonResponse(
        {
          error: "Missing required resume input (resumeId, resumeText, or structuredResume)",
        },
        400,
      );
    }

    const prompt = `
You are a senior ATS resume rewriting expert.

TASK:
Rewrite the FULL resume in professional English only.

RULES:
- Do NOT invent information
- Use only the provided resume content and analysis
- Improve summary, skills, formatting, and experience bullets
- Make the resume ATS-friendly
- Align it with the target role when possible
- Return VALID JSON ONLY
- No markdown
- No explanations outside JSON

TARGET ROLE:
${targetJobTitle || "Not specified"}

ANALYSIS:
${JSON.stringify(analysis ?? {}, null, 2)}

STRUCTURED RESUME:
${JSON.stringify(structuredResume ?? {}, null, 2)}

RAW RESUME:
${resumeText ?? ""}

Return JSON in exactly this format:
{
  "summary": {
    "targetRole": "",
    "atsScoreContext": "",
    "improvements": []
  },
  "issues": {
    "weaknesses": [],
    "recommendedFixes": []
  },
  "rewrittenResume": ""
}
`.trim();

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an ATS resume rewriting expert. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const aiJson = await aiRes.json();

    if (!aiRes.ok) {
      console.error("OpenAI request failed:", JSON.stringify(aiJson));
      return jsonResponse({ error: "OpenAI request failed", details: aiJson }, 500);
    }

    const content = aiJson?.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: "Empty AI response" }, 500);
    }

    let parsed: RewriteResponse;

    try {
      const cleaned = String(content)
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = String(content).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return jsonResponse(
            {
              error: "AI returned invalid JSON",
              raw: String(content).trim(),
            },
            500,
          );
        }
      } else {
        return jsonResponse(
          {
            error: "AI returned non-JSON content",
            raw: String(content).trim(),
          },
          500,
        );
      }
    }

    const normalized = {
      summary: {
        targetRole: parsed?.summary?.targetRole ?? targetJobTitle ?? "",
        atsScoreContext: parsed?.summary?.atsScoreContext ?? "",
        improvements: Array.isArray(parsed?.summary?.improvements)
          ? parsed.summary!.improvements.map((s) => String(s)).filter(Boolean)
          : Array.isArray(parsed?.improvement_summary)
            ? parsed.improvement_summary.map((s) => String(s)).filter(Boolean)
            : Array.isArray(parsed?.improvements)
              ? parsed.improvements.map((s) => String(s)).filter(Boolean)
              : [],
      },
      issues: {
        weaknesses: Array.isArray(parsed?.issues?.weaknesses)
          ? parsed.issues!.weaknesses.map((s) => String(s)).filter(Boolean)
          : Array.isArray(parsed?.weaknesses)
            ? parsed.weaknesses.map((s) => String(s)).filter(Boolean)
            : [],
        recommendedFixes: Array.isArray(parsed?.issues?.recommendedFixes)
          ? parsed.issues!.recommendedFixes.map((s) => String(s)).filter(Boolean)
          : Array.isArray(parsed?.recommendedFixes)
            ? parsed.recommendedFixes.map((s) => String(s)).filter(Boolean)
            : [],
      },
      rewrittenResume: String(parsed?.rewrittenResume ?? parsed?.rewritten_resume ?? "").trim(),
    };

    if (!normalized.rewrittenResume) {
      return jsonResponse(
        {
          error: "AI response did not include rewrittenResume",
          raw: parsed,
        },
        500,
      );
    }

    return jsonResponse(normalized);
  } catch (error) {
    console.error("rewrite-resume error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});


