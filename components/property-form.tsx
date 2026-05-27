"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProperty } from "@/lib/actions/properties";
import type { CreatePropertyInput } from "@/lib/schemas/property";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface PropertyFormProps {
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
}

export function PropertyForm({ onSuccess, onCancel }: PropertyFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);

    const input: CreatePropertyInput = {
      name: fd.get("name") as string,
      city: (fd.get("city") as string) || undefined,
      region: (fd.get("region") as string) || undefined,
      house_rules: (fd.get("house_rules") as string) || undefined,
      local_tips: (fd.get("local_tips") as string) || undefined,
      wifi_ssid: (fd.get("wifi_ssid") as string) || undefined,
      wifi_password: (fd.get("wifi_password") as string) || undefined,
      door_code: (fd.get("door_code") as string) || undefined,
      gate_code: (fd.get("gate_code") as string) || undefined,
      address_line: (fd.get("address_line") as string) || undefined,
      postal_code: (fd.get("postal_code") as string) || undefined,
      parking_notes: (fd.get("parking_notes") as string) || undefined,
    };

    const result = await createProperty(input);

    setLoading(false);

    if (result.error) {
      setErrors(result.error as Record<string, string[]>);
      return;
    }

    if (result.data && onSuccess) {
      onSuccess(result.data.id);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Property details section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Property details</h3>

        <div className="space-y-2">
          <Label htmlFor="prop-name">Property name</Label>
          <Input id="prop-name" name="name" placeholder="Vineyard House" required />
          {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-city">City</Label>
            <Input id="prop-city" name="city" placeholder="Sonoma" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-region">State / Region</Label>
            <Input id="prop-region" name="region" placeholder="California" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-rules">House rules</Label>
          <textarea
            id="prop-rules"
            name="house_rules"
            rows={3}
            placeholder="No shoes inside, quiet hours after 10pm..."
            className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-tips">Local tips</Label>
          <textarea
            id="prop-tips"
            name="local_tips"
            rows={3}
            placeholder="Best coffee: Blue Barn on the square..."
            className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Sensitive info section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Sensitive info</h3>
        <p className="text-xs text-ink-light">
          This info is stored separately and only shown to verified guests.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-wifi-ssid">Wifi name</Label>
            <Input id="prop-wifi-ssid" name="wifi_ssid" placeholder="VineyardGuest" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-wifi-pass">Wifi password</Label>
            <Input id="prop-wifi-pass" name="wifi_password" placeholder="••••••" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-door">Door code</Label>
            <Input id="prop-door" name="door_code" placeholder="1234#" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-gate">Gate code</Label>
            <Input id="prop-gate" name="gate_code" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-address">Address</Label>
            <Input id="prop-address" name="address_line" placeholder="123 Vineyard Ln" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-postal">Postal code</Label>
            <Input id="prop-postal" name="postal_code" placeholder="95476" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-parking">Parking notes</Label>
          <textarea
            id="prop-parking"
            name="parking_notes"
            rows={2}
            placeholder="Park in the gravel lot, not on the grass..."
            className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {errors._form && <p className="text-sm text-red-600">{errors._form[0]}</p>}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-fern text-white hover:bg-fern-dark"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save property"
          )}
        </Button>
      </div>
    </form>
  );
}
