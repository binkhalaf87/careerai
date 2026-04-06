import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// Max results per page to cap RapidAPI usage
const MAX_RESULTS_PER_PAGE = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // BUG-04 FIX: Require authentication to prevent unauthorized API quota drain
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      return new Response(JSON.stringify({ error: "RAPIDAPI_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      query = "",
      city = "",
      page = 1,
      date_posted = "all",
      employment_types = "",
      remote_only = false,
      num_pages = 1,
    } = body;

    // Build search query
    let searchQuery = query.trim();
    if (city.trim()) {
      searchQuery += ` in ${city.trim()}`;
    }

    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "Search query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      query: searchQuery,
      page: String(page),
      num_pages: String(Math.min(num_pages, 3)), // Cap at 3 pages max
    });

    if (date_posted && date_posted !== "all") {
      params.set("date_posted", date_posted);
    }
    if (employment_types) {
      params.set("employment_types", employment_types);
    }
    if (remote_only) {
      params.set("remote_jobs_only", "true");
    }

    const url = `https://jsearch.p.rapidapi.com/search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`JSearch API error [${response.status}]:`, errorText);
      return new Response(JSON.stringify({ error: `Job search API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Map the response to a cleaner format
    const jobs = (data.data || []).map((job: any) => ({
      job_id: job.job_id || "",
      job_title: job.job_title || "",
      employer_name: job.employer_name || "",
      employer_logo: job.employer_logo || null,
      job_city: job.job_city || "",
      job_state: job.job_state || "",
      job_country: job.job_country || "",
      job_employment_type: job.job_employment_type || "",
      job_apply_link: job.job_apply_link || "",
      job_description: (job.job_description || "").slice(0, 500),
      job_posted_at: job.job_posted_at_datetime_utc || "",
      job_is_remote: job.job_is_remote || false,
      job_min_salary: job.job_min_salary || null,
      job_max_salary: job.job_max_salary || null,
      job_salary_currency: job.job_salary_currency || null,
      job_salary_period: job.job_salary_period || null,
      job_required_skills: job.job_required_skills || [],
      job_required_experience_months: job.job_required_experience?.required_experience_in_months || null,
      job_highlights: {
        qualifications: job.job_highlights?.Qualifications?.slice(0, 5) || [],
        responsibilities: job.job_highlights?.Responsibilities?.slice(0, 5) || [],
      },
    }));

    return new Response(
      JSON.stringify({
        jobs,
        total: data.data?.length || 0,
        status: "OK",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("search-jobs error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
