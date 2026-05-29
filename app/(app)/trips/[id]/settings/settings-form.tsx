"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SettingsFormProps {
  tripId: string;
  requirePin: boolean;
  hasPin: boolean;
}

export function SettingsForm({ tripId, requirePin, hasPin }: SettingsFormProps) {
  const router = useRouter();
  const [pinEnabled, setPinEnabled] = useState(requirePin);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        require_pin_to_view: pinEnabled,
        pin: pinEnabled ? pin || undefined : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to save");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-ink">Security</h3>

        <div className="flex items-center justify-between">
          <div>
            <Label>Require PIN to view</Label>
            <p className="text-xs text-ink-light">
              Guests must enter a PIN before seeing trip details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPinEnabled(!pinEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              pinEnabled ? "bg-forest" : "bg-sand"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                pinEnabled ? "translate-x-5" : "translate-x-0.5"
              } mt-0.5`}
            />
          </button>
        </div>

        {pinEnabled && (
          <div className="space-y-2">
            <Label htmlFor="pin">Trip PIN</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={hasPin ? "Enter new PIN to change" : "Set a PIN"}
            />
            {hasPin && !pin && (
              <p className="text-xs text-ink-light">Leave blank to keep current PIN.</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={handleSave}
        className="w-full bg-forest text-white hover:bg-forest-dark"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          "Saved!"
        ) : (
          "Save settings"
        )}
      </Button>
    </div>
  );
}
