"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyPicker } from "@/components/property-picker";
import { createTrip } from "@/lib/actions/trips";
import type { CreateTripInput } from "@/lib/schemas/trip";
import { Loader2 } from "lucide-react";
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

export function TripForm({ properties }: TripFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [datesTbd, setDatesTbd] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);

    const input: CreateTripInput = {
      name: formData.get("name") as string,
      starts_on: datesTbd ? null : (formData.get("starts_on") as string) || null,
      ends_on: datesTbd ? null : (formData.get("ends_on") as string) || null,
      city: (formData.get("city") as string) || undefined,
      region: (formData.get("region") as string) || undefined,
      property_id: propertyId,
    };

    const result = await createTrip(input);

    if (result?.error) {
      setErrors(result.error as Record<string, string[]>);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Trip name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Sonoma Weekend"
          required
          autoFocus
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Dates</Label>
          <button
            type="button"
            onClick={() => setDatesTbd(!datesTbd)}
            className="text-xs text-fern hover:text-fern-dark"
          >
            {datesTbd ? "Set dates" : "Dates TBD"}
          </button>
        </div>
        {!datesTbd && (
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
        )}
        {datesTbd && (
          <p className="text-sm text-ink-light">
            You can set dates later or use availability polling.
          </p>
        )}
      </div>

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

      <div className="space-y-2">
        <Label>Property (optional)</Label>
        <p className="text-xs text-ink-light">
          Link a saved property to auto-fill wifi, rules, and more.
        </p>
        <PropertyPicker
          properties={properties}
          selectedId={propertyId}
          onSelect={setPropertyId}
        />
      </div>

      {errors._form && (
        <p className="text-sm text-red-600">{errors._form[0]}</p>
      )}

      <Button
        type="submit"
        className="w-full bg-fern text-white hover:bg-fern-dark"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create trip"
        )}
      </Button>
    </form>
  );
}
