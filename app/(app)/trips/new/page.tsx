import { TripForm } from "@/components/trip-form";
import { getMyProperties } from "@/lib/actions/properties";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewTripPage() {
  const properties = await getMyProperties();

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink">Start a Trip</h1>
        <p className="mt-1 text-sm text-ink-light">
          Name it, pick dates (or leave TBD), and invite your crew.
        </p>
      </header>
      <div className="rounded-card border bg-card p-6 shadow-card">
        <TripForm properties={properties} />
      </div>
    </div>
  );
}
