"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

/** A <form> bound to a server action that returns ActionResult; shows the outcome inline. */
export function ActionForm({
  action,
  children,
  className = "",
  reset = false,
  submitLabel,
  submitClass = "btn btn-primary",
  pendingLabel = "Saving…",
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  reset?: boolean;
  submitLabel?: string;
  submitClass?: string;
  pendingLabel?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_prev, fd) => {
    const r = await action(fd);
    if (r.ok && reset) ref.current?.reset();
    return r;
  }, null);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {(submitLabel || state) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {submitLabel && (
            <button className={submitClass} disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </button>
          )}
          {state && !state.ok && (
            <p role="alert" className="text-sm text-rose">
              {state.error}
            </p>
          )}
          {state && state.ok && state.message && (
            <p role="status" className="text-sm text-sage">
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

/** A button that runs a server action, with optional confirmation or a required reason. */
export function ActionButton({
  action,
  children,
  className = "btn btn-quiet",
  confirm,
  prompt,
  promptRequired = false,
}: {
  action: (input?: string) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  prompt?: string;
  promptRequired?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          let input: string | undefined;
          if (prompt) {
            const v = window.prompt(prompt);
            if (v === null) return;
            if (promptRequired && !v.trim()) return;
            input = v;
          } else if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action(input);
            setResult(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        {pending ? "Working…" : children}
      </button>
      {result && !result.ok && (
        <span role="alert" className="max-w-xs text-[13px] text-rose">
          {result.error}
        </span>
      )}
      {result && result.ok && result.message && (
        <span role="status" className="max-w-xs text-[13px] text-sage">
          {result.message}
        </span>
      )}
    </span>
  );
}
