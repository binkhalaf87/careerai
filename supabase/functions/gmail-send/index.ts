import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub as string;

    const { action, to, subject, body, resumeId, resumeType, marketingEmailId } = await req.json();

    if (!action || !to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, to, subject, body" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanTo = String(to).trim();
    if (!emailRegex.test(cleanTo)) {
      return new Response(JSON.stringify({ error: `Invalid recipient email: ${cleanTo}` }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Get Gmail tokens using service role
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: gmailToken, error: tokenError } = await serviceSupabase
      .from("gmail_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokenError || !gmailToken) {
      return new Response(JSON.stringify({ error: "Gmail not connected. Please connect your Gmail account first." }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Refresh token if expired
    let accessToken = gmailToken.access_token;
    const expiresAt = new Date(gmailToken.expires_at);
    if (expiresAt <= new Date()) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
          client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
          refresh_token: gmailToken.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      if (refreshData.error) {
        // Token revoked - delete stored tokens
        await serviceSupabase.from("gmail_tokens").delete().eq("user_id", userId);
        return new Response(JSON.stringify({ error: "Gmail session expired. Please reconnect your Gmail account." }), {
          status: 401, headers: corsHeaders,
        });
      }

      accessToken = refreshData.access_token;
      const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

      await serviceSupabase
        .from("gmail_tokens")
        .update({ access_token: accessToken, expires_at: newExpiry })
        .eq("user_id", userId);
    }

    // Get resume attachment if provided
    let attachmentData: { filename: string; content: string; mimeType: string } | null = null;

    if (resumeId) {
      if (resumeType === "uploaded") {
        const { data: resume } = await supabase
          .from("resumes")
          .select("file_name, file_path, file_type")
          .eq("id", resumeId)
          .single();

        if (resume?.file_path) {
          const { data: fileData } = await supabase.storage
            .from("resumes")
            .download(resume.file_path);

          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            attachmentData = {
              filename: resume.file_name || "resume.pdf",
              content: base64Encode(arrayBuffer),
              mimeType: resume.file_type || "application/pdf",
            };
          }
        }
      } else if (resumeType === "generated") {
        const { data: genResume } = await supabase
          .from("generated_resumes")
          .select("title, content")
          .eq("id", resumeId)
          .single();

        if (genResume?.content) {
          const textContent = JSON.stringify(genResume.content, null, 2);
          const encoder = new TextEncoder();
          const encoded = encoder.encode(textContent);
          attachmentData = {
            filename: `${genResume.title || "resume"}.json`,
            content: base64Encode(encoded.buffer as ArrayBuffer),
            mimeType: "application/json",
          };
        }
      }
    }

    // Build MIME message
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
    const fromEmail = gmailToken.gmail_email || "me";

    let mimeMessage = "";

    if (attachmentData) {
      mimeMessage = [
        `From: ${fromEmail}`,
        `To: ${cleanTo}`,
        `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: base64`,
        "",
        btoa(unescape(encodeURIComponent(`<html><body><div dir="auto" style="font-family:Arial,sans-serif;white-space:pre-wrap;">${body.replace(/\n/g, "<br>")}</div></body></html>`))),
        "",
        `--${boundary}`,
        `Content-Type: ${attachmentData.mimeType}`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${attachmentData.filename}"`,
        "",
        attachmentData.content,
        "",
        `--${boundary}--`,
      ].join("\r\n");
    } else {
      mimeMessage = [
        `From: ${fromEmail}`,
        `To: ${cleanTo}`,
        `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: base64`,
        "",
        btoa(unescape(encodeURIComponent(`<html><body><div dir="auto" style="font-family:Arial,sans-serif;white-space:pre-wrap;">${body.replace(/\n/g, "<br>")}</div></body></html>`))),
      ].join("\r\n");
    }

    // URL-safe base64 encode the full message
    const rawMessage = btoa(unescape(encodeURIComponent(mimeMessage)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    let gmailUrl: string;
    let gmailMethod = "POST";
    let gmailBody: string;

    if (action === "send") {
      gmailUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
      gmailBody = JSON.stringify({ raw: rawMessage });
    } else if (action === "draft") {
      gmailUrl = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
      gmailBody = JSON.stringify({ message: { raw: rawMessage } });
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'send' or 'draft'." }), {
        status: 400, headers: corsHeaders,
      });
    }

    const gmailRes = await fetch(gmailUrl, {
      method: gmailMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: gmailBody,
    });

    const gmailResult = await gmailRes.json();

    if (!gmailRes.ok) {
      console.error("Gmail API error:", gmailResult);
      return new Response(JSON.stringify({
        error: `Gmail API error: ${gmailResult.error?.message || JSON.stringify(gmailResult)}`,
      }), {
        status: gmailRes.status, headers: corsHeaders,
      });
    }

    // Update marketing_emails record if provided
    if (marketingEmailId) {
      await supabase
        .from("marketing_emails")
        .update({
          action_type: action === "send" ? "sent" : "draft",
          gmail_status: action === "send" ? "sent" : "drafted",
        })
        .eq("id", marketingEmailId);
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      messageId: gmailResult.id,
      gmailEmail: fromEmail,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Gmail send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
