import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// BUG-01 FIX: Unified costs — must match src/lib/points.ts
const SERVICE_COSTS: Record<string, number> = {
  analysis: 3,
  enhancement: 5,
  interview: 5,
  builder: 3,
  smart_apply: 10,
  marketing_per_100: 15,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { service, description } = await req.json();
    const cost = SERVICE_COSTS[service];

    if (!cost || typeof cost !== "number" || cost <= 0) {
      return new Response(JSON.stringify({ error: "Invalid service" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB operations
    const adminSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // BUG-02 FIX: Use atomic RPC to avoid race condition (double-spend).
    // The Postgres function handles balance check + deduction in one locked transaction.
    const { data: result, error: rpcError } = await adminSupabase.rpc("deduct_points_atomic", {
      p_user_id: user.id,
      p_cost: cost,
      p_type: service,
      p_description: description || `${service} service usage`,
    });

    if (rpcError) {
      console.error("deduct_points_atomic RPC error:", rpcError);
      return new Response(JSON.stringify({ success: false, balance: 0, error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = typeof result === "string" ? JSON.parse(result) : result;

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deduct-points error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
