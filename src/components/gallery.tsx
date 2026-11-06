"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Thumb } from "@/components/ui";
import { deleteImage } from "@/app/actions";

export function Gallery({ photos, alt, canDelete }: { photos: { id: string; src: string }[]; alt: string; canDelete?: boolean }) {
  const [index, setIndex] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (photos.length === 0) {
    return (
      <div>
        <Thumb alt={alt} className="aspect-[4/3] w-full rounded-[var(--radius-soft)]" />
        <p className="mt-2 text-[13px] text-muted">No photos yet. Add your screenshot below — the app never substitutes stock images.</p>
      </div>
    );
  }
  return (
    <div>
      <div
        className="snap-row no-scrollbar flex overflow-x-auto rounded-[var(--radius-soft)] bg-linen"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.src} alt={alt} className="aspect-[4/3] w-full shrink-0 object-contain" data-testid="gallery-photo" />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px] text-muted">
        <span>
          {photos.length > 1 ? `${Math.min(index + 1, photos.length)} / ${photos.length} — swipe for more` : "1 photo"}
        </span>
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            className="underline-offset-4 hover:underline"
            onClick={() => {
              if (!confirm("Remove this photo?")) return;
              start(async () => {
                await deleteImage(photos[Math.min(index, photos.length - 1)].id);
                router.refresh();
              });
            }}
          >
            Remove this photo
          </button>
        )}
      </div>
    </div>
  );
}
