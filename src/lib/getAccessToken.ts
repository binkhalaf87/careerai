import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's JWT access token.
 * Throws if the session is missing or expired so callers can show a proper error.
 */
export async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Auth error: ${error.message}`);
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error("Session expired. Please sign in again.");
  }

  return token;
}
