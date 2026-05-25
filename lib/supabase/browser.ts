"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

export function useSupabaseBrowserClient(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        accessToken: async () => {
          const token = await session?.getToken();
          return token ?? null;
        },
      }),
    [session],
  );
}
