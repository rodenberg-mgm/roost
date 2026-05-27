import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page">
      <div className="rounded-card bg-card p-8 shadow-card">
        <h1 className="font-display text-3xl font-bold text-fern">Roost</h1>
        <p className="mt-2 mb-4 text-ink-light">
          Your shared stay, all in one place.
        </p>
        <Button className="bg-fern text-white hover:bg-fern-dark">
          Start a Trip
        </Button>
      </div>
    </main>
  );
}
