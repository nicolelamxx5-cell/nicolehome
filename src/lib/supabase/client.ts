"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { AUTH_COOKIE, SUPABASE_VIA_APP } from "./cookie";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser Supabase client (used for direct, private uploads to Storage). */
export function getBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      SUPABASE_VIA_APP ? `${window.location.origin}/supabase` : process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: AUTH_COOKIE },
    );
  }
  return client;
}
