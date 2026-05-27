import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-5xl font-bold text-fern">Roost</h1>
        <p className="mt-3 text-lg text-ink-light">
          Your shared stay, all in one place.
        </p>
        <p className="mt-6 text-sm text-ink-light">
          Trip details, packing lists, meal plans, photos, and
          more&thinsp;&mdash;&thinsp;so your group chat can go back to being
          fun.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-fern text-white hover:bg-fern-dark">
            <Link href="/login">Get Started</Link>
          </Button>
          <Button asChild variant="outline" className="border-sand text-ink hover:bg-sand/20">
            <Link href="/login">Join with invite link</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
