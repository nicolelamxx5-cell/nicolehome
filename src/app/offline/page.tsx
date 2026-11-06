export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <div className="eyebrow">661C Home Hub</div>
      <h1 className="font-display mt-2 text-4xl">You’re offline</h1>
      <p className="mt-3 text-[15px] text-muted">
        This page hasn’t been saved on this phone yet. Pages you have opened before still work offline, and you can keep adding products — open
        <a href="/add" className="mx-1 underline underline-offset-4">Add</a>
        and they will upload when you reconnect.
      </p>
      <p className="mt-6 text-[13px] text-muted">In mainland China, if hotel Wi-Fi or a local SIM cannot reach the app, switch to your Singapore roaming data.</p>
    </main>
  );
}
