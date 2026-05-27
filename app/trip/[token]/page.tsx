interface TripViewProps {
  params: Promise<{ token: string }>;
}

export default async function TripViewPage({ params }: TripViewProps) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold text-fern">Roost</h1>
        <p className="mt-2 text-ink-light">
          Trip view coming soon.
        </p>
        <p className="mt-4 font-mono text-xs text-ink-light/50">
          Token: {token.slice(0, 8)}...
        </p>
      </div>
    </main>
  );
}
