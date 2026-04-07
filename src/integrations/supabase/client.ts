// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === "undefined") {
  throw new Error("VITE_SUPABASE_URL is missing");
}

if (!supabaseAnonKey || supabaseAnonKey === "undefined") {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "talentry-auth-token",
  },
});

