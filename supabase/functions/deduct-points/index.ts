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

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function deductPointsFallback(
  adminSupabase: ReturnType<typeof createClient>,
  userId: string,
  cost: number,
  service: string,
  description: string,
) {
  const { data: transactions, error: balanceError } = await adminSupabase
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId);

  if (balanceError) {
    console.error("deduct-points fallback balance error:", balanceError);
    throw new Error(balanceError.message || "Failed to load point balance");
  }

  const balance = Array.isArray(transactions)
    ? transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    : 0;

  if (balance < cost) {
    return { success: false, balance, error: "Insufficient points" };
  }

  const { error: insertError } = await adminSupabase
    .from("point_transactions")
    .insert({
      user_id: userId,
      amount: -cost,
      type: service,
      description,
    });

  if (insertError) {
    console.error("deduct-points fallback insert error:", insertError);
    throw new Error(insertError.message || "Failed to deduct points");
  }

  return { success: true, balance: balance - cost };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("deduct-points missing env", {
        hasSupabaseUrl: !!supabaseUrl,
        hasAnonKey: !!anonKey,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { service, description } = await req.json();
    const cost = SERVICE_COSTS[service];

    if (!cost || typeof cost !== "number" || cost <= 0) {
      return jsonResponse({ error: "Invalid service" }, 400);
    }

    // Use service role for DB operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const safeDescription = typeof description === "string" && description.trim()
      ? description.trim()
      : `${service} service usage`;

    // BUG-02 FIX: Use atomic RPC to avoid race condition (double-spend).
    // The Postgres function handles balance check + deduction in one locked transaction.
    const { data: result, error: rpcError } = await adminSupabase.rpc("deduct_points_atomic", {
      p_user_id: user.id,
      p_cost: cost,
      p_type: service,
      p_description: safeDescription,
    });

    if (rpcError) {
      console.error("deduct_points_atomic RPC error:", rpcError);
      const fallbackResult = await deductPointsFallback(adminSupabase, user.id, cost, service, safeDescription);
      console.info("deduct-points fallback result:", {
        userId: user.id,
        service,
        success: fallbackResult.success,
        balance: fallbackResult.balance,
      });
      return jsonResponse(fallbackResult, 200);
    }

    const parsed = typeof result === "string" ? JSON.parse(result) : result;

    console.info("deduct-points rpc result:", {
      userId: user.id,
      service,
      success: parsed?.success === true,
      balance: parsed?.balance ?? null,
    });
    return jsonResponse(parsed, 200);
  } catch (e) {
    console.error("deduct-points error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

