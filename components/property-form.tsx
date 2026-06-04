"use client";

import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListEditor } from "@/components/ui/list-editor";
import { createProperty, updateProperty } from "@/lib/actions/properties";
import type { CreatePropertyInput } from "@/lib/schemas/property";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";

interface PropertyFormProps {
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
  /** When true, renders as a div instead of form to avoid nested-form hydration errors */
  inline?: boolean;
  /** When set, the form edits this property instead of creating a new one. */
  propertyId?: string;
  /** Initial field values for edit mode (uncontrolled defaults). */
  initialValues?: Partial<CreatePropertyInput>;
}

export function PropertyForm({
  onSuccess,
  onCancel,
  inline,
  propertyId,
  initialValues,
}: PropertyFormProps) {
  const isEdit = !!propertyId;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const [addressLine, setAddressLine] = useState(initialValues?.address_line || "");
  const [city, setCity] = useState(initialValues?.city || "");
  const [region, setRegion] = useState(initialValues?.region || "");
  const [postalCode, setPostalCode] = useState(initialValues?.postal_code || "");
  const [prefilledFromAddress, setPrefilledFromAddress] = useState(false);

  function getInputValue(name: string): string {
    if (!containerRef.current) return "";
    const el = containerRef.current.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    return el?.value || "";
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setLoading(true);
    setErrors({});

    const parseList = (name: string): string[] => {
      try {
        const v = JSON.parse(getInputValue(name) || "[]");
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    };

    const input: CreatePropertyInput = {
      name: getInputValue("name"),
      city: city || undefined,
      region: region || undefined,
      house_rules: parseList("house_rules"),
      local_tips: parseList("local_tips"),
      stocked_items: parseList("stocked_items"),
      wifi_ssid: getInputValue("wifi_ssid") || undefined,
      wifi_password: getInputValue("wifi_password") || undefined,
      door_code: getInputValue("door_code") || undefined,
      gate_code: getInputValue("gate_code") || undefined,
      address_line: addressLine || undefined,
      postal_code: postalCode || undefined,
      parking_notes: getInputValue("parking_notes") || undefined,
    };

    const result = isEdit
      ? await updateProperty(propertyId, input)
      : await createProperty(input);

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
    <div ref={containerRef} className="space-y-6">
      {/* Property details section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Property details</h3>

        <div className="space-y-2">
          <Label htmlFor="prop-name">Property name</Label>
          <Input id="prop-name" name="name" placeholder="Vineyard House" required defaultValue={initialValues?.name} />
          {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
        </div>

        {/* Location — address leads and auto-fills the public city/state/zip */}
        <div className="space-y-2">
          <Label htmlFor="prop-address">Address</Label>
          <AddressAutocomplete
            id="prop-address"
            value={addressLine}
            onChange={setAddressLine}
            onSelect={({ city: c, region: r, postalCode: pc }) => {
              if (c) setCity(c);
              if (r) setRegion(r);
              if (pc) setPostalCode(pc);
              if (c || r) setPrefilledFromAddress(true);
            }}
          />
          <p className="text-xs text-ink-light">
            Start here — we&apos;ll fill in city, state &amp; zip. Kept private; only verified guests see the full address.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-city">City</Label>
            <Input id="prop-city" name="city" value={city}
              onChange={(e) => { setCity(e.target.value); setPrefilledFromAddress(false); }}
              placeholder="Sonoma" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-region">State / Region</Label>
            <Input id="prop-region" name="region" value={region}
              onChange={(e) => setRegion(e.target.value)} placeholder="California" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-postal">Postal code</Label>
            <Input id="prop-postal" name="postal_code" value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)} placeholder="95476" />
          </div>
        </div>
        {prefilledFromAddress && (
          <p className="-mt-1 text-xs text-ink-light">
            City &amp; state filled from the address — edit if needed. Shown publicly instead of your address.
          </p>
        )}

        <div className="space-y-2">
          <Label>House rules</Label>
          <ListEditor name="house_rules" initialItems={initialValues?.house_rules}
            placeholder="No shoes inside" addLabel="Add a house rule" />
        </div>

        <div className="space-y-2">
          <Label>Local tips</Label>
          <ListEditor name="local_tips" initialItems={initialValues?.local_tips}
            placeholder="Best coffee: Blue Barn on the square" addLabel="Add a local tip" />
        </div>

        <div className="space-y-2">
          <Label>Stocked items</Label>
          <ListEditor name="stocked_items" initialItems={initialValues?.stocked_items}
            placeholder="Coffee" addLabel="Add a stocked item" />
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
            <Input id="prop-wifi-ssid" name="wifi_ssid" placeholder="VineyardGuest" defaultValue={initialValues?.wifi_ssid} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-wifi-pass">Wifi password</Label>
            <Input id="prop-wifi-pass" name="wifi_password" placeholder="••••••" defaultValue={initialValues?.wifi_password} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-door">Door code</Label>
            <Input id="prop-door" name="door_code" placeholder="1234#" defaultValue={initialValues?.door_code} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-gate">Gate code</Label>
            <Input id="prop-gate" name="gate_code" defaultValue={initialValues?.gate_code} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-parking">Parking notes</Label>
          <textarea
            id="prop-parking"
            name="parking_notes"
            rows={2}
            placeholder="Park in the gravel lot, not on the grass..."
            defaultValue={initialValues?.parking_notes}
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
          type="button"
          onClick={() => handleSubmit()}
          className="flex-1 bg-forest text-white hover:bg-forest-dark"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Save property"
          )}
        </Button>
      </div>
    </div>
  );
}
