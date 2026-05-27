"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    house_rules: string | null;
    local_tips: string | null;
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
  const [stockedInput, setStockedInput] = useState(
    initialData.stocked_items.join(", ")
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const result = await updateTrip(tripId, {
      name: fd.get("name") as string,
      starts_on: (fd.get("starts_on") as string) || null,
      ends_on: (fd.get("ends_on") as string) || null,
      city: (fd.get("city") as string) || undefined,
      region: (fd.get("region") as string) || undefined,
      house_rules: (fd.get("house_rules") as string) || undefined,
      local_tips: (fd.get("local_tips") as string) || undefined,
      stocked_items: stockedInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      wifi_ssid: (fd.get("wifi_ssid") as string) || undefined,
      wifi_password: (fd.get("wifi_password") as string) || undefined,
      door_code: (fd.get("door_code") as string) || undefined,
      gate_code: (fd.get("gate_code") as string) || undefined,
      address_line: (fd.get("address_line") as string) || undefined,
      postal_code: (fd.get("postal_code") as string) || undefined,
      parking_notes: (fd.get("parking_notes") as string) || undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push(`/trips/${tripId}`);
    router.refresh();
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="starts_on">Start date</Label>
            <Input id="starts_on" name="starts_on" type="date" defaultValue={initialData.starts_on || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ends_on">End date</Label>
            <Input id="ends_on" name="ends_on" type="date" defaultValue={initialData.ends_on || ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={initialData.city || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">State / Region</Label>
            <Input id="region" name="region" defaultValue={initialData.region || ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="house_rules">House rules</Label>
          <textarea id="house_rules" name="house_rules" rows={4} defaultValue={initialData.house_rules || ""} className={textareaClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="local_tips">Local tips</Label>
          <textarea id="local_tips" name="local_tips" rows={4} defaultValue={initialData.local_tips || ""} className={textareaClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stocked_items">Stocked items (comma-separated)</Label>
          <Input id="stocked_items" value={stockedInput} onChange={(e) => setStockedInput(e.target.value)} placeholder="Coffee, paper towels, firewood" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Sensitive info</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wifi_ssid">Wifi name</Label>
            <Input id="wifi_ssid" name="wifi_ssid" defaultValue={sensitiveData?.wifi_ssid || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wifi_password">Wifi password</Label>
            <Input id="wifi_password" name="wifi_password" defaultValue={sensitiveData?.wifi_password || ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="door_code">Door code</Label>
            <Input id="door_code" name="door_code" defaultValue={sensitiveData?.door_code || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gate_code">Gate code</Label>
            <Input id="gate_code" name="gate_code" defaultValue={sensitiveData?.gate_code || ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="address_line">Address</Label>
            <Input id="address_line" name="address_line" defaultValue={sensitiveData?.address_line || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal code</Label>
            <Input id="postal_code" name="postal_code" defaultValue={sensitiveData?.postal_code || ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parking_notes">Parking notes</Label>
          <textarea id="parking_notes" name="parking_notes" rows={2} defaultValue={sensitiveData?.parking_notes || ""} className={textareaClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-fern text-white hover:bg-fern-dark" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
