"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { importWorkbook, type ImportReport } from "./actions";

const LABELS: Record<string, string> = {
  rooms_created: "Rooms created",
  items_created: "Items created",
  items_updated: "Items updated",
  items_linked: "Linked to items already in the app",
  items_unchanged: "Items unchanged",
  conflicts: "Conflicts (kept your app edits)",
  options_created: "Candidate products created",
  payments_created: "Payments created",
  flagged_for_review: "Flagged for review",
  warnings: "Warnings",
  errors: "Not saved (errors)",
};

export function ImportForm() {
  // React resets forms after each action, so keep the chosen file between "Check" and "Import".
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ImportReport | null, FormData>((prev, fd) => {
    const f = fd.get("file");
    if ((!(f instanceof File) || f.size === 0) && fileRef.current) fd.set("file", fileRef.current);
    return importWorkbook(prev, fd);
  }, null);
  return (
    <div>
      <form action={action} className="card p-5">
        <label className="label" htmlFor="file">Your renovation tracker (.xlsx or .xlsm)</label>
        <input id="file" name="file" type="file" accept=".xlsx,.xlsm,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="field"
          onChange={(e) => {
            fileRef.current = e.target.files?.[0] ?? null;
            setFileName(fileRef.current?.name ?? null);
          }}
        />
        {fileName && <p className="mt-2 text-[13px] text-muted">Selected: {fileName}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* The clicked button's name/value is sent with the form */}
          <button className="btn btn-quiet" disabled={pending} name="mode" value="preview">
            Check file first
          </button>
          <button className="btn btn-primary" disabled={pending} name="mode" value="import" data-testid="run-import">
            {pending ? "Working…" : "Import"}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-muted">Importing again later is safe: rows are matched by their ID (e.g. 03-005), so nothing is duplicated and edits you made in the app are kept.</p>
      </form>

      {state && !state.ok && <p role="alert" className="mt-4 text-sm text-rose">{state.error}</p>}
      {state?.ok && (
        <div className="mt-6 space-y-4" data-testid="import-report">
          <div className="card p-5">
            <div className="font-display text-2xl">{state.dryRun ? "What will happen" : "Import complete"}</div>
            {state.rooms && <p className="mt-1 text-[13px] text-muted">Room sheets found: {state.rooms.join(", ")}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-3">
              {Object.entries(state.summary ?? {}).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] text-muted">{LABELS[k] ?? k}</dt>
                  <dd className="font-display text-2xl tabular-nums" data-testid={`sum-${k}`}>{v}</dd>
                </div>
              ))}
            </dl>
            {!state.dryRun && (
              <div className="mt-4 flex gap-2">
                <Link href="/shop" className="btn btn-primary btn-sm">See your rooms</Link>
                <Link href="/shop?review=1" className="btn btn-quiet btn-sm">Review flagged items</Link>
              </div>
            )}
          </div>
          {(state.conflicts ?? []).length > 0 && (
            <div className="card p-5">
              <div className="font-medium">Changed in both the app and the workbook</div>
              <p className="text-[13px] text-muted">The app’s value was kept. Update it in the app if the workbook is right.</p>
              <ul className="mt-2 text-[13px]">
                {state.conflicts!.map((c, i) => (
                  <li key={i}>{c.legacyId} · {c.field}: app “{String(c.appValue)}”, workbook “{String(c.workbookValue)}”</li>
                ))}
              </ul>
            </div>
          )}
          {(state.issues ?? []).length > 0 && (
            <div className="card p-5">
              <div className="font-medium">Notes from the import</div>
              <ul className="mt-2 space-y-2 text-[13px]">
                {state.issues!.map((i, idx) => (
                  <li key={idx} className={i.severity === "conflict" ? "text-rose" : i.severity === "warning" ? "text-ink" : "text-muted"}>
                    <span className="uppercase tracking-wide">{i.severity}</span> · {i.sheet ? `${i.sheet}${i.row ? ` row ${i.row}` : ""}: ` : ""}
                    {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
