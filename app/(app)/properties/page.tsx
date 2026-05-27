import { EmptyState } from "@/components/empty-state";
import { getMyProperties } from "@/lib/actions/properties";
import { ArrowLeft, Home, Plus } from "lucide-react";
import Link from "next/link";

export default async function PropertiesPage() {
  const properties = await getMyProperties();

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink">My Properties</h1>
        </div>
        {properties.length > 0 && (
          <Link
            href="/properties/new"
            className="flex h-9 w-9 items-center justify-center rounded-button bg-fern text-white hover:bg-fern-dark"
          >
            <Plus className="h-5 w-5" />
          </Link>
        )}
      </header>

      {properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Save a property to auto-fill wifi, rules, and house info across trips."
          action={{ label: "Add Property", href: "/properties/new" }}
        />
      ) : (
        <div className="space-y-3">
          {properties.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card"
            >
              <Home className="h-5 w-5 text-roost" />
              <div>
                <h3 className="font-semibold text-ink">{p.name}</h3>
                {(p.city || p.region) && (
                  <p className="text-sm text-ink-light">
                    {[p.city, p.region].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
