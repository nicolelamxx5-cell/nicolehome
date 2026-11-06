import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="eyebrow">661C Edgedale Plains</div>
        <h1 className="font-display mt-2 text-4xl">Home Hub</h1>
        <p className="mt-3 text-[15px] text-muted">Your private renovation shopping list and budget.</p>
      </div>
      <div className="card p-6">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-[13px] text-muted">Only invited household members can see your home’s information.</p>
    </main>
  );
}
