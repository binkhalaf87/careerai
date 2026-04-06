import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

/**
 * Paymob KSA HMAC verification.
 * Concatenates specific transaction fields in lexicographic order,
 * then computes HMAC-SHA512 and compares with the received value.
 */
async function verifyPaymobHmac(
  txn: Record<string, unknown>,
  receivedHmac: string,
  secret: string,
): Promise<boolean> {
  if (!receivedHmac || !secret) return false;
  try {
    // Paymob specifies these fields in lexicographic key order
    const obj = txn as Record<string, any>;
    const fields = [
      String(obj.amount_cents ?? ""),
      String(obj.created_at ?? ""),
      String(obj.currency ?? ""),
      String(obj.error_occured ?? obj.error_occurred ?? ""),
      String(obj.has_parent_transaction ?? ""),
      String(obj.id ?? ""),
      String(obj.integration_id ?? ""),
      String(obj.is_3d_secure ?? ""),
      String(obj.is_auth ?? ""),
      String(obj.is_capture ?? ""),
      String(obj.is_refunded ?? ""),
      String(obj.is_standalone_payment ?? ""),
      String(obj.is_voided ?? ""),
      String(obj.order?.id ?? ""),
      String(obj.owner ?? ""),
      String(obj.pending ?? ""),
      String(obj.source_data?.pan ?? ""),
      String(obj.source_data?.sub_type ?? ""),
      String(obj.source_data?.type ?? ""),
      String(obj.success ?? ""),
    ];
    const concatenated = fields.join("");

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(concatenated);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computed = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computed.toLowerCase() === receivedHmac.toLowerCase();
  } catch (e) {
    console.error("HMAC computation error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const HMAC_SECRET = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!HMAC_SECRET) throw new Error("PAYMOB_HMAC_SECRET not configured");

    const url = new URL(req.url);
    const receivedHmac = url.searchParams.get("hmac") || "";

    const body = await req.text();
    let payload: any;

    // Parse body (JSON or form-encoded)
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = JSON.parse(body);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(body);
      const dataStr = params.get("data") || params.get("obj") || body;
      try { payload = JSON.parse(dataStr); } catch { payload = Object.fromEntries(params); }
    } else {
      try { payload = JSON.parse(body); } catch { payload = {}; }
    }

    // The transaction object from Paymob
    const txn = payload.obj || payload;

    // ── HMAC Verification ──────────────────────────────────────────────
    const hmacValid = await verifyPaymobHmac(txn, receivedHmac, HMAC_SECRET);
    if (!hmacValid) {
      console.error("Paymob webhook HMAC verification FAILED");
      return new Response(JSON.stringify({ status: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("HMAC verification passed");

    // ── Extract fields ─────────────────────────────────────────────────
    const transactionId = String(txn.id || txn.transaction_id || "");
    const success = txn.success === true || txn.success === "true";
    const orderId = String(txn.order?.id || txn.order_id || "");
    const intentionId = String(txn.payment_intent?.id || txn.intention_id || "");
    const amountCents = Number(txn.amount_cents || txn.amount || 0);
    const paymentMethod = txn.source_data?.type || txn.payment_method || "card";

    const extras = txn.order?.extras || txn.extras || {};
    const userId = extras.user_id || "";
    const points = parseInt(extras.points || "0", 10);

    console.log("Webhook data:", { transactionId, success, orderId, intentionId, userId, points, amountCents });

    if (!userId || !points) {
      console.error("Missing user_id or points in extras");
      return new Response(JSON.stringify({ status: "ignored", reason: "missing_data" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (success) {
      // ── Idempotency: check if this transaction was already processed ──
      if (transactionId) {
        const { data: dup } = await adminSupabase
          .from("payment_orders")
          .select("id")
          .eq("paymob_transaction_id", transactionId)
          .eq("status", "paid")
          .limit(1);

        if (dup && dup.length > 0) {
          console.log(`TX ${transactionId} already processed. Skipping.`);
          return new Response(JSON.stringify({ status: "already_processed" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── Find matching pending order ──────────────────────────────────
      // Try by intention_id first (most reliable), then by user_id fallback
      let pendingOrder: { id: string; amount_cents: number; points: number } | null = null;

      if (intentionId) {
        const { data } = await adminSupabase
          .from("payment_orders")
          .select("id, amount_cents, points")
          .eq("paymob_intention_id", intentionId)
          .eq("status", "pending")
          .limit(1);
        if (data && data.length > 0) pendingOrder = data[0];
      }

      if (!pendingOrder) {
        const { data } = await adminSupabase
          .from("payment_orders")
          .select("id, amount_cents, points")
          .eq("user_id", userId)
          .eq("status", "pending")
          .is("paymob_transaction_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) pendingOrder = data[0];
      }

      if (!pendingOrder) {
        console.warn(`No pending order found for user ${userId} / intention ${intentionId}`);
        return new Response(JSON.stringify({ status: "no_pending_order" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Amount validation ────────────────────────────────────────────
      if (amountCents > 0 && pendingOrder.amount_cents !== amountCents) {
        console.error(`Amount mismatch: expected ${pendingOrder.amount_cents}, got ${amountCents}`);
        await adminSupabase
          .from("payment_orders")
          .update({ status: "failed", error_message: `Amount mismatch: expected ${pendingOrder.amount_cents}, got ${amountCents}` })
          .eq("id", pendingOrder.id)
          .eq("status", "pending");
        return new Response(JSON.stringify({ status: "amount_mismatch" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Atomically mark as paid (guard: only if still pending) ──────
      const { data: updated } = await adminSupabase
        .from("payment_orders")
        .update({
          status: "paid",
          paymob_transaction_id: transactionId,
          paymob_order_id: orderId,
          payment_method: paymentMethod,
        })
        .eq("id", pendingOrder.id)
        .eq("status", "pending")
        .select("id, points");

      if (updated && updated.length > 0) {
        const creditPoints = updated[0].points;
        await adminSupabase.from("point_transactions").insert({
          user_id: userId,
          amount: creditPoints,
          type: "purchase",
          description: `Purchased ${creditPoints} points via Paymob (TX: ${transactionId})`,
        });
        console.log(`Credited ${creditPoints} points to ${userId} for TX: ${transactionId}`);
      } else {
        console.warn(`Order ${pendingOrder.id} was already updated. Skipping credit.`);
      }
    } else {
      // ── Failed payment ───────────────────────────────────────────────
      await adminSupabase
        .from("payment_orders")
        .update({
          status: "failed",
          paymob_transaction_id: transactionId,
          error_message: txn.data?.message || "Payment failed",
        })
        .match({ user_id: userId, status: "pending" });
      console.log(`Payment failed for user ${userId}`);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paymob-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
