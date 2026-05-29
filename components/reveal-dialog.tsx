"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";

interface RevealDialogProps {
  tripId: string;
  userEmail: string;
  requirePin: boolean;
  onRevealed: () => void;
  onClose: () => void;
}

export function RevealDialog({
  tripId,
  userEmail,
  requirePin,
  onRevealed,
  onClose,
}: RevealDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  async function handleVerify() {
    setLoading(true);
    setError(null);

    const endpoint = requirePin ? "/api/reveal/pin" : "/api/reveal/email";
    const body = requirePin
      ? { tripId, pin }
      : { tripId };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Verification failed");
      return;
    }

    onRevealed();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-card border bg-card p-6 shadow-card-hover">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-forest" />
          <h3 className="font-semibold text-ink">Verify to reveal</h3>
        </div>

        {requirePin ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-light">
              Enter the trip PIN to see wifi, codes, and address.
            </p>
            <div className="space-y-2">
              <Label htmlFor="pin">Trip PIN</Label>
              <Input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-light">
            Confirm your email (<strong>{userEmail}</strong>) matches the invite
            to see wifi, codes, and address.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            className="flex-1 bg-forest text-white hover:bg-forest-dark"
            disabled={loading || (requirePin && !pin)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Reveal"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
