import { Button } from "@/components/ui/button";
import { CabinScene, LocationPin, PineRow } from "@/components/illustrations";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="topo-bg flex min-h-dvh flex-col items-center px-6 pb-10 pt-12">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center text-center">
        {/* Wordmark with pin accent */}
        <div className="animate-fade-in flex items-center gap-2">
          <LocationPin className="h-5 w-5" />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-forest/70">
            Field guide for groups
          </span>
        </div>

        <h1 className="animate-slide-up delay-1 mt-3 font-display text-6xl font-bold uppercase tracking-tight text-forest">
          Roost
        </h1>

        {/* Tagline */}
        <h2 className="animate-slide-up delay-2 mt-4 font-display text-2xl font-bold uppercase leading-[1.12] text-ink">
          Your shared stay,
          <br />
          all in one place.
        </h2>

        <div className="animate-fade-in delay-3 mx-auto mt-4 h-[3px] w-10 rounded-full bg-brick" />

        {/* Hero illustration in a framed field-guide card */}
        <div className="animate-scale-in delay-3 mt-6 w-full">
          <CabinScene className="mx-auto h-auto w-full max-w-[320px]" />
        </div>

        {/* Body copy */}
        <p className="animate-slide-up delay-4 mt-6 max-w-xs text-[0.95rem] leading-relaxed text-ink-light">
          Roost keeps trip details, house info, lists, and memories together —
          so you can focus on the people you came for.
        </p>
      </div>

      {/* CTAs */}
      <div className="animate-slide-up delay-5 mt-8 flex w-full max-w-sm flex-col gap-3">
        <Button asChild size="lg" className="w-full text-base font-semibold">
          <Link href="/login">Start a Trip</Link>
        </Button>
        <Link
          href="/login"
          className="inline-block text-center font-mono text-sm tracking-wide text-ink-light underline decoration-sand decoration-2 underline-offset-4 transition-colors hover:text-forest"
        >
          Join with invite link
        </Link>
      </div>

      <PineRow className="animate-fade-in delay-6 mt-8 h-8 w-48 opacity-80" />
    </main>
  );
}
