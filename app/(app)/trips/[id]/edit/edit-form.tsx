"use client";

import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListEditor } from "@/components/ui/list-editor";
import { updateTrip } from "@/lib/actions/trips";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface EditFormProps {
  tripId: string;
  initialData: {
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    city: string | null;
    region: string | null;
    house_rules: string[];
    local_tips: string[];
    stocked_items: string[];
  };
  sensitiveData: {
    wifi_ssid: string | null;
    wifi_password: string | null;
    door_code: string | null;
    gate_code: string | null;
    address_line: string | null;
    postal_code: string | null;
    parking_notes: string | null;
  } | null;
}

export function EditForm({ tripId, initialData, sensitiveData }: EditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location fields are controlled so address autocomplete can prefill them.
  const [city, setCity] = useState(initialData.city || "");
  const [region, setRegion] = useState(initialData.region || "");
  const [addressLine, setAddressLine] = useState(sensitiveData?.address_line || "");
  const [postalCode, setPostalCode] = useState(sensitiveData?.postal_code || "");
  const [prefilledFromAddress, setPrefilledFromAddress] = useState(false);

  const parseList = (v: FormDataEntryValue | null): string[] => {
    try {
      const arr = JSON.parse((v as string) || "[]");
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const result = await updateTrip(tripId, {
      name: fd.get("name") as string,
      starts_on: (fd.get("starts_on") as string) || null,
      ends_on: (fd.get("ends_on") as string) || null,
      city: city || undefined,
      region: region || undefined,
      house_rules: parseList(fd.get("house_rules")),
      local_tips: parseList(fd.get("local_tips")),
      stocked_items: parseList(fd.get("stocked_items")),
      wifi_ssid: (fd.get("wifi_ssid") as string) || undefined,
      wifi_password: (fd.get("wifi_password") as string) || undefined,
      door_code: (fd.get("door_code") as string) || undefined,
      gate_code: (fd.get("gate_code") as string) || undefined,
      address_line: addressLine || undefined,
      postal_code: postalCode || undefined,
      parking_notes: (fd.get("parking_notes") as string) || undefined,
    });

    // On success, updateTrip redirects server-side to /dashboard?saved=1.
    // It only returns here when there's an error to show.
    if (result?.error) {
      setLoading(false);
      setError(result.error);
    }
  }

  // Use native textarea styling
  const textareaClass = "w-full rounded-input border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Trip name</Label>
          <Input id="name" name="name" defaultValue={initialData.name} required />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="starts_on">Start date</Label>
            <Input id="starts_on" name="starts_on" type="date" defaultValue={initialData.starts_on || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ends_on">End date</Label>
            <Input id="ends_on" name="ends_on" type="date" defaultValue={initialData.ends_on || ""} />
          </div>
        </div>

        {/* Location — address leads and auto-fills the public city/state/zip below */}
        <div className="space-y-2">
          <Label htmlFor="address_line">Address</Label>
          <AddressAutocomplete
            id="address_line"
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
            Start here — we&apos;ll fill in the city, state &amp; zip. Kept private; guests must
            join &amp; verify to see the full address.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPrefilledFromAddress(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">State / Region</Label>
            <Input
              id="region"
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal code</Label>
            <Input
              id="postal_code"
              name="postal_code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>
        {prefilledFromAddress && (
          <p className="-mt-2 text-xs text-ink-light">
            City &amp; state filled from the address — edit if needed. Shown publicly instead of your address.
          </p>
        )}

        <div className="space-y-2">
          <Label>House rules</Label>
          <ListEditor name="house_rules" initialItems={initialData.house_rules}
            placeholder="No shoes inside" addLabel="Add a house rule" />
        </div>

        <div className="space-y-2">
          <Label>Local tips</Label>
          <ListEditor name="local_tips" initialItems={initialData.local_tips}
            placeholder="Best coffee on the square" addLabel="Add a local tip" />
        </div>

        <div className="space-y-2">
          <Label>Stocked items</Label>
          <ListEditor name="stocked_items" initialItems={initialData.stocked_items}
            placeholder="Coffee" addLabel="Add a stocked item" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Sensitive info</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wifi_ssid">Wifi name</Label>
            <Input id="wifi_ssid" name="wifi_ssid" defaultValue={sensitiveData?.wifi_ssid || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wifi_password">Wifi password</Label>
            <Input id="wifi_password" name="wifi_password" defaultValue={sensitiveData?.wifi_password || ""} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="door_code">Door code</Label>
            <Input id="door_code" name="door_code" defaultValue={sensitiveData?.door_code || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gate_code">Gate code</Label>
            <Input id="gate_code" name="gate_code" defaultValue={sensitiveData?.gate_code || ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parking_notes">Parking notes</Label>
          <textarea id="parking_notes" name="parking_notes" rows={2} defaultValue={sensitiveData?.parking_notes || ""} className={textareaClass} />
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-forest text-white hover:bg-forest-dark" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
