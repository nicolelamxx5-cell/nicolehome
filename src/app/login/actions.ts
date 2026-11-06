"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Creds = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  next: z.string().optional(),
});

export type AuthState = { error?: string; message?: string };

function safeNext(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message };
  redirect(safeNext(parsed.data.next));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: site ? { emailRedirectTo: `${site}/auth/confirm` } : undefined,
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm your address, then sign in." };
  redirect("/setup");
}
