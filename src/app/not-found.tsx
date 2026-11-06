import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <div className="eyebrow">661C Home Hub</div>
      <h1 className="font-display mt-2 text-4xl">Not found</h1>
      <p className="mt-3 text-[15px] text-muted">This page doesn’t exist, or it belongs to a household you’re not part of.</p>
      <Link href="/" className="btn btn-primary mx-auto mt-6">Go home</Link>
    </main>
  );
}
