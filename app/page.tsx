import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="topo-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        {/* Logo text */}
        <h1 className="font-display text-6xl font-bold uppercase tracking-tight text-forest">
          Roost
        </h1>

        {/* Tagline in display font */}
        <p className="mt-4 font-display text-xl font-bold uppercase leading-tight text-ink">
          Your shared stay,<br />all in one place.
        </p>

        {/* Divider line */}
        <div className="mx-auto mt-4 h-0.5 w-12 bg-brick" />

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-ink-light">
          Roost keeps trip details, house info, lists, expenses, and
          memories together — so you can focus on what matters most.
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-3">
          <Button
            asChild
            className="w-full bg-forest text-white shadow-button hover:bg-forest-dark"
            size="lg"
          >
            <Link href="/login">Start a Trip</Link>
          </Button>
          <Link
            href="/login"
            className="inline-block font-mono text-sm text-ink-light underline decoration-sand underline-offset-4 hover:text-ink"
          >
            Join with invite link
          </Link>
        </div>
      </div>
    </main>
  );
}
