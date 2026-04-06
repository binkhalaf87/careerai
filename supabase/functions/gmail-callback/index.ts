import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(buildRedirectHtml("", false, `Google OAuth error: ${error}`), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (!code || !stateRaw) {
      return new Response(buildRedirectHtml("", false, "Missing code or state"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // BUG-03 FIX: Validate state token against DB instead of trusting raw JSON
    // This prevents OAuth CSRF attacks where attacker forges state with victim's user_id
    let stateToken: string;
    let redirectUri = "";
    try {
      const parsed = JSON.parse(stateRaw);
      stateToken = parsed.token;
      redirectUri = parsed.redirect_uri || "";
    } catch {
      return new Response(buildRedirectHtml("", false, "Invalid state parameter"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (!stateToken) {
      return new Response(buildRedirectHtml("", false, "Missing state token"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Look up the state token in DB (must exist, be unused, and not expired)
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("user_id, redirect_uri, expires_at, used")
      .eq("token", stateToken)
      .single();

    if (stateError || !oauthState) {
      return new Response(buildRedirectHtml("", false, "Invalid or expired OAuth state"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (oauthState.used) {
      return new Response(buildRedirectHtml("", false, "OAuth state already used"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (new Date(oauthState.expires_at) < new Date()) {
      return new Response(buildRedirectHtml("", false, "OAuth state expired"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const userId = oauthState.user_id;
    if (!redirectUri) redirectUri = oauthState.redirect_uri || "";

    // Mark token as used immediately (single-use enforcement)
    await supabase.from("oauth_states").update({ used: true }).eq("token", stateToken);

    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/gmail-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(
        buildRedirectHtml(redirectUri, false, `Token error: ${tokenData.error_description || tokenData.error}`),
        {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        },
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      return new Response(buildRedirectHtml(redirectUri, false, "Missing tokens in response"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Get Gmail email address
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const gmailEmail = userInfo.email || "";

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Upsert Gmail tokens
    const { data: existing } = await supabase.from("gmail_tokens").select("id").eq("user_id", userId).single();

    if (existing) {
      await supabase
        .from("gmail_tokens")
        .update({
          access_token,
          refresh_token,
          expires_at: expiresAt,
          gmail_email: gmailEmail,
        })
        .eq("user_id", userId);
    } else {
      await supabase.from("gmail_tokens").insert({
        user_id: userId,
        access_token,
        refresh_token,
        expires_at: expiresAt,
        gmail_email: gmailEmail,
      });
    }

    return new Response(buildRedirectHtml(redirectUri, true, ""), {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (err: any) {
    console.error("Gmail callback error:", err);
    return new Response(buildRedirectHtml("", false, err.message), {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});

function buildRedirectHtml(redirectUri: string, success: boolean, errorMsg: string): string {
  const target = redirectUri || "/marketing";
  const params = success ? "?gmail=connected" : `?gmail=error&msg=${encodeURIComponent(errorMsg)}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Gmail Connection</title></head>
<body>
<script>
  window.opener?.postMessage({ type: "gmail-oauth-result", success: ${success}, error: "${errorMsg.replace(/"/g, '\\"')}" }, "*");
  window.location.href = "${target}${params}";
</script>
<p>Redirecting...</p>
</body>
</html>`;
}
