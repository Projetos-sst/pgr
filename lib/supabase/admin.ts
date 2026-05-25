import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Admin (secret-key) client. BYPASSA RLS.
 * Uso EXCLUSIVO: webhook do Clerk e tarefas de manutenção server-side.
 * NUNCA importar de Route Handler/Server Action atendendo usuário final
 * — use `createSupabaseServerClient()` (token Clerk + RLS).
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  if (!secret.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY must be a secret key (sb_secret_...). Legacy service_role keys are deprecated.",
    );
  }

  cached = createClient(SUPABASE_URL, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
