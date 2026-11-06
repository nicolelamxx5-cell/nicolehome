"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-[15px] text-muted">
        {typeof navigator !== "undefined" && !navigator.onLine
          ? "You appear to be offline. Pages you opened before still work; new products can be added from Add."
          : "Please try again. If it keeps happening, note what you were doing."}
      </p>
      {error.digest && <p className="mt-2 text-[12px] text-muted">Reference: {error.digest}</p>}
      <button className="btn btn-primary mt-6" onClick={reset}>Try again</button>
    </div>
  );
}
