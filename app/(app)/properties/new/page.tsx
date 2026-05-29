import { PropertyPageContent } from "./property-page-content";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewPropertyPage() {
  return (
    <div>
      <header className="mb-6">
        <Link
          href="/properties"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink">Add Property</h1>
        <p className="mt-1 text-sm text-ink-light">
          Save property details so they auto-fill when you create trips.
        </p>
      </header>
      <div className="rounded-card border bg-card p-6 shadow-card">
        <PropertyPageContent />
      </div>
    </div>
  );
}
