"use client";
import { useActionState } from "react";
import { createHousehold, type SetupState } from "./actions";

export function CreateHouseholdForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(createHousehold, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Home name</label>
        <input id="name" name="name" className="field" defaultValue="661C Edgedale Plains" required />
      </div>
      <div>
        <label className="label" htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" className="field" placeholder="e.g. Nicole" required />
      </div>
      {state.error && <p role="alert" className="text-sm text-rose">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Setting up…" : "Create our Home Hub"}</button>
    </form>
  );
}
