import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email confirmation link target (enable "Confirm email" in Supabase Auth settings).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (token_hash && type) await supabase.auth.verifyOtp({ token_hash, type });
  else if (code) await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL("/setup", request.url));
}
