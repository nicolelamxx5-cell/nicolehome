"use client";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} className="field" />
      </div>
      {state.error && <p role="alert" className="text-sm text-rose">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-sage">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
      </button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "First time here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
