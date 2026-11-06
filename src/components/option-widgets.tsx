"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Minus, CircleDashed } from "lucide-react";
import { setPreference, setCheck, setOptionStatus } from "@/app/actions";
import { VOTE_LABEL } from "@/lib/labels";

export function VoteBar({ optionId, mine }: { optionId: string; mine: string | null }) {
  const [vote, setVote] = useState(mine);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Your preference">
      {Object.entries(VOTE_LABEL).map(([k, label]) => (
        <button
          key={k}
          type="button"
          disabled={pending}
          aria-pressed={vote === k}
          onClick={() =>
            start(async () => {
              const next = vote === k ? null : k;
              setVote(next);
              await setPreference(optionId, next as never);
              router.refresh();
            })
          }
          className={`btn btn-sm ${vote === k ? "btn-primary" : "btn-quiet"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const STATES = [
  { key: "confirmed", label: "Confirmed", icon: Check },
  { key: "not_applicable", label: "N/A", icon: Minus },
  { key: "failed", label: "Failed", icon: X },
  { key: "pending", label: "Pending", icon: CircleDashed },
] as const;

export function CheckRow({
  check,
  resolvedBy,
}: {
  check: { id: string; title: string; detail: string | null; critical: boolean; state: string; evidence: string | null; resolved_at: string | null };
  resolvedBy?: string;
}) {
  const [state, setState] = useState(check.state);
  const [evidence, setEvidence] = useState(check.evidence ?? "");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const tone = state === "confirmed" ? "text-sage" : state === "failed" ? "text-rose" : state === "not_applicable" ? "text-muted" : "text-amber";
  const save = (s: string) =>
    start(async () => {
      setState(s);
      await setCheck(check.id, s as never, evidence);
      router.refresh();
    });
  return (
    <li className="px-4 py-3">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`mt-0.5 text-[12px] font-medium uppercase tracking-wide ${tone} w-20 shrink-0`}>{STATES.find((x) => x.key === state)?.label}</span>
        <span className="flex-1 text-[14px] leading-snug">
          {check.title}
          {check.critical && <span className="ml-2 chip bg-rose/10 text-rose">Critical</span>}
          {check.evidence && !open && <span className="mt-1 block text-[12px] text-muted">Evidence: {check.evidence}</span>}
        </span>
      </button>
      {open && (
        <div className="mt-3 pl-0 sm:pl-[5.75rem]">
          {check.detail && <p className="mb-2 text-[13px] text-muted">{check.detail}</p>}
          <label className="label" htmlFor={`ev-${check.id}`}>Evidence (who confirmed, measurement, document)</label>
          <input id={`ev-${check.id}`} className="field" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. Lift door 1.05 m wide, measured 6 Nov" />
          <div className="mt-2 flex flex-wrap gap-2">
            {STATES.map((s) => (
              <button key={s.key} type="button" disabled={pending} onClick={() => save(s.key)} className={`btn btn-sm ${state === s.key ? "btn-primary" : "btn-quiet"}`}>
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </div>
          {resolvedBy && check.resolved_at && (
            <p className="mt-2 text-[12px] text-muted">
              Marked by {resolvedBy} on {new Date(check.resolved_at).toLocaleDateString("en-SG")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function StatusSwitcher({ optionId, status }: { optionId: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (status === "approved" || status === "ordered") return null;
  const choices = [
    { k: "wishlist", l: "Wishlist" },
    { k: "shortlisted", l: "Shortlist" },
    { k: "pending_confirmation", l: "Pending confirmation" },
    { k: "cancelled", l: "Not this one" },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Option status">
      {choices.map((c) => (
        <button
          key={c.k}
          type="button"
          disabled={pending}
          aria-pressed={status === c.k}
          onClick={() =>
            start(async () => {
              await setOptionStatus(optionId, c.k as never);
              router.refresh();
            })
          }
          className={`btn btn-sm ${status === c.k ? "btn-primary" : "btn-quiet"}`}
        >
          {c.l}
        </button>
      ))}
    </div>
  );
}
