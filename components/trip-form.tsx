"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyPicker } from "@/components/property-picker";
import { createTrip } from "@/lib/actions/trips";
import type { CreateTripInput } from "@/lib/schemas/trip";
import { ArrowLeft, Home, Loader2, MapPin } from "lucide-react";
import { useState } from "react";

interface Property {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
}

interface TripFormProps {
  properties: Property[];
}

type Step = "choose" | "property" | "details";
type Mode = "recurring" | "oneoff";

export function TripForm({ properties }: TripFormProps) {
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<Mode | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [datesTbd, setDatesTbd] = useState(false);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);

    const input: CreateTripInput = {
      name: formData.get("name") as string,
      starts_on: datesTbd ? null : (formData.get("starts_on") as string) || null,
      ends_on: datesTbd ? null : (formData.get("ends_on") as string) || null,
      // For the recurring path, city/region are inherited from the property on link.
      city: mode === "oneoff" ? (formData.get("city") as string) || undefined : undefined,
      region: mode === "oneoff" ? (formData.get("region") as string) || undefined : undefined,
      property_id: mode === "recurring" ? propertyId : null,
    };

    const result = await createTrip(input);

    // createTrip redirects to the new trip on success; only returns on error.
    if (result?.error) {
      setErrors(result.error as Record<string, string[]>);
      setLoading(false);
    }
  }

  // ── Step 1: choose where they're staying ──
  if (step === "choose") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setMode("recurring");
            setStep("property");
          }}
          className="flex w-full items-start gap-4 rounded-card border bg-card p-5 text-left shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest/8">
            <Home className="h-5 w-5 text-forest" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
              A place you host or stay at often
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-light">
              Your lake house, a family cabin, a spot you rebook. Save its wifi, address &amp;
              codes once — every trip there fills them in automatically.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("oneoff");
            setStep("details");
          }}
          className="flex w-full items-start gap-4 rounded-card border bg-card p-5 text-left shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/20">
            <MapPin className="h-5 w-5 text-sage-dark" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
              A one-off rental or somewhere new
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-light">
              A bachelor-party Airbnb, a beach rental, a one-time booking. Just name it and add
              the details to this trip.
            </p>
          </div>
        </button>
      </div>
    );
  }

  // ── Step 2 (recurring only): pick or create a property ──
  if (step === "property") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep("choose")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-card border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold uppercase text-ink">
            Which place?
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-light">
            Pick a saved property or add a new one. The trip will inherit its wifi, address &amp;
            codes — you can still tweak anything per trip.
          </p>

          <PropertyPicker
            properties={properties}
            selectedId={propertyId}
            onSelect={setPropertyId}
          />

          <Button
            type="button"
            size="lg"
            className="mt-5 w-full"
            disabled={!propertyId}
            onClick={() => setStep("details")}
          >
            {propertyId ? "Continue" : "Pick a property to continue"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: trip details ──
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={() => setStep(mode === "recurring" ? "property" : "choose")}
        className="inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="space-y-6 rounded-card border bg-card p-6 shadow-card">
        {mode === "recurring" && (
          <div className="flex items-center gap-2 rounded-input bg-forest/5 px-3 py-2.5 text-sm text-ink">
            <Home className="h-4 w-4 shrink-0 text-forest" />
            <span>
              Using{" "}
              <span className="font-semibold">
                {selectedProperty?.name || "your property"}
              </span>
              {" "}— location &amp; house info come from it.
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Trip name</Label>
          <Input id="name" name="name" placeholder="Sonoma Weekend" required autoFocus />
          {errors.name && <p className="text-sm text-brick">{errors.name[0]}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Dates</Label>
            <button
              type="button"
              onClick={() => setDatesTbd(!datesTbd)}
              className="font-mono text-[0.65rem] uppercase tracking-wider text-forest hover:text-forest-dark"
            >
              {datesTbd ? "Set dates" : "Dates TBD"}
            </button>
          </div>
          {!datesTbd ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="starts_on" className="text-xs text-ink-light">Start</Label>
                <Input id="starts_on" name="starts_on" type="date" />
              </div>
              <div>
                <Label htmlFor="ends_on" className="text-xs text-ink-light">End</Label>
                <Input id="ends_on" name="ends_on" type="date" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-light">
              You can set dates later or use availability polling.
            </p>
          )}
        </div>

        {/* One-off rentals capture their own location; recurring inherits it. */}
        {mode === "oneoff" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Sonoma" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">State / Region</Label>
              <Input id="region" name="region" placeholder="California" />
            </div>
          </div>
        )}

        {errors._form && <p className="text-sm text-brick">{errors._form[0]}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create trip"
          )}
        </Button>
      </div>
    </form>
  );
}
