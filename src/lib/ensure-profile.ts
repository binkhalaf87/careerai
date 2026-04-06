import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function pickDisplayName(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw = [meta.full_name, meta.name, meta.user_name, user.email?.split("@")[0]]
    .map((value) => String(value ?? "").trim())
    .find(Boolean);
  return raw || "User";
}

function pickAvatarUrl(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const avatar = String(meta.avatar_url ?? meta.picture ?? "").trim();
  return avatar || null;
}

export async function ensureUserProfile(user: User | null | undefined): Promise<void> {
  if (!user?.id) return;

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("[ensureUserProfile] read error:", readError.message);
    return;
  }

  if (existing?.user_id) return;

  const payload = {
    user_id: user.id,
    email: user.email ?? null,
    display_name: pickDisplayName(user),
    avatar_url: pickAvatarUrl(user),
  };

  const { error: insertError } = await supabase.from("profiles").insert(payload);
  if (insertError) {
    console.error("[ensureUserProfile] insert error:", insertError.message);
  }
}
