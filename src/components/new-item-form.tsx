"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/app/actions";

export function NewItemForm({ roomId }: { roomId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      action={(fd) =>
        start(async () => {
          fd.set("roomId", roomId);
          const r = await createItem(fd);
          if (!r.ok) setError(r.error);
          else router.push(`/items/${r.id}`);
        })
      }
    >
      <input name="name" required maxLength={200} className="field flex-1" placeholder="e.g. Dining pendant light" aria-label="Item name" />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add item"}
      </button>
      {error && <p className="text-sm text-rose">{error}</p>}
    </form>
  );
}
