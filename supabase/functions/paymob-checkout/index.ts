import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const PAYMOB_API = "https://ksa.paymob.com/v1/intention/";

interface PackageInfo {
  points: number;
  amount_cents: number;
  name: string;
}

const PACKAGES: Record<string, PackageInfo> = {
  starter: { points: 30, amount_cents: 2900, name: "Starter Plan" },
  pro: { points: 100, amount_cents: 7900, name: "Pro Plan" },
  business: { points: 300, amount_cents: 14900, name: "Business Plan" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PAYMOB_SECRET_KEY = Deno.env.get("PAYMOB_SECRET_KEY");
    if (!PAYMOB_SECRET_KEY) throw new Error("PAYMOB_SECRET_KEY is not configured");

    const PAYMOB_CARD_INTEGRATION_ID = Deno.env.get("PAYMOB_CARD_INTEGRATION_ID");
    const PAYMOB_WALLET_INTEGRATION_ID = Deno.env.get("PAYMOB_WALLET_INTEGRATION_ID");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { packageId } = await req.json();
    const pkg = PACKAGES[packageId];
    if (!pkg) throw new Error("Invalid package");

    // Get user profile for billing info
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name, phone")
      .eq("user_id", userId)
      .single();

    const email = profile?.email || claimsData.claims.email || "user@example.com";
    const name = profile?.display_name || "User";

    // Build payment methods array
    const paymentMethods: string[] = [];
    if (PAYMOB_CARD_INTEGRATION_ID) paymentMethods.push(PAYMOB_CARD_INTEGRATION_ID);
    if (PAYMOB_WALLET_INTEGRATION_ID) paymentMethods.push(PAYMOB_WALLET_INTEGRATION_ID);
    if (paymentMethods.length === 0) throw new Error("No payment integrations configured");

    // Create payment intention via Paymob API
    const intentionBody = {
      amount: pkg.amount_cents,
      currency: "SAR",
      payment_methods: paymentMethods,
      billing_data: {
        first_name: name.split(" ")[0] || "User",
        last_name: name.split(" ").slice(1).join(" ") || ".",
        email,
        phone_number: profile?.phone || "+966500000000",
        country: "SA",
        state: "N/A",
        city: "N/A",
        street: "N/A",
        building: "N/A",
        floor: "N/A",
        apartment: "N/A",
      },
      items: [{
        name: pkg.name,
        amount: pkg.amount_cents,
        quantity: 1,
        description: `${pkg.points} credits`,
      }],
      extras: {
        user_id: userId,
        package_id: packageId,
        points: String(pkg.points),
      },
    };

    const paymobRes = await fetch(PAYMOB_API, {
      method: "POST",
      headers: {
        Authorization: `Token ${PAYMOB_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intentionBody),
    });

    if (!paymobRes.ok) {
      const errText = await paymobRes.text();
      console.error("Paymob API error:", paymobRes.status, errText);
      throw new Error(`Paymob API error: ${paymobRes.status}`);
    }

    const paymobData = await paymobRes.json();
    const clientSecret = paymobData.client_secret;
    const intentionId = paymobData.id;

    // Save order in DB using service role
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await adminSupabase.from("payment_orders").insert({
      user_id: userId,
      paymob_intention_id: String(intentionId),
      amount_cents: pkg.amount_cents,
      currency: "SAR",
      points: pkg.points,
      package_name: pkg.name,
      status: "pending",
    });

    // Build checkout URL
    const PAYMOB_PUBLIC_KEY = Deno.env.get("PAYMOB_PUBLIC_KEY") || "";
    const checkoutUrl = `https://ksa.paymob.com/unifiedcheckout/?publicKey=${PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;

    return new Response(JSON.stringify({
      checkout_url: checkoutUrl,
      client_secret: clientSecret,
      intention_id: intentionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paymob-checkout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
