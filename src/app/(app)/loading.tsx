export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-3 w-24 rounded bg-greige" />
      <div className="mt-3 h-9 w-64 rounded bg-greige" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-28" />
        ))}
      </div>
    </div>
  );
}
