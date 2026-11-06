// A fixed cookie name so the server and the browser share one session even when
// the browser reaches Supabase through a different address (see SUPABASE_PROXY_TARGET).
export const AUTH_COOKIE = { name: "sb-homehub-auth-token" };

/** True when the browser should reach Supabase through this app at /supabase (previews). */
export const SUPABASE_VIA_APP = process.env.NEXT_PUBLIC_SUPABASE_PROXY === "1";
