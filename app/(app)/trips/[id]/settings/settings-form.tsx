"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { archiveTrip, deleteTrip, unarchiveTrip } from "@/lib/actions/trips";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SettingsFormProps {
  tripId: string;
  requirePin: boolean;
  hasPin: boolean;
  archived: boolean;
  isPrimaryHost: boolean;
}

export function SettingsForm({ tripId, requirePin, hasPin, archived, isPrimaryHost }: SettingsFormProps) {
  const router = useRouter();
  const [pinEnabled, setPinEnabled] = useState(requirePin);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Trip management (archive / delete)
  const [manageBusy, setManageBusy] = useState<"archive" | "delete" | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleArchiveToggle() {
    setManageBusy("archive");
    setManageError(null);
    const res = archived ? await unarchiveTrip(tripId) : await archiveTrip(tripId);
    setManageBusy(null);
    if ("error" in res && res.error) {
      setManageError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setManageBusy("delete");
    setManageError(null);
    const res = await deleteTrip(tripId);
    if ("error" in res && res.error) {
      setManageBusy(null);
      setManageError(res.error);
      return;
    }
    router.push("/dashboard");
  }

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

      {isPrimaryHost && (
        <div className="space-y-3 border-t border-subtle pt-6">
          <div>
            <h3 className="font-semibold text-ink">Manage trip</h3>
            <p className="text-xs text-ink-light">
              {archived
                ? "This trip is archived — hidden from your dashboard until you bring it back."
                : "Archiving hides a trip from your dashboard without deleting anything."}
            </p>
          </div>

          {manageError && <p className="text-sm text-brick">{manageError}</p>}

          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={manageBusy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-button border border-subtle px-4 py-2.5 text-sm text-ink transition-colors hover:bg-sand/40 disabled:opacity-50"
          >
            {manageBusy === "archive" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : archived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {archived ? "Unarchive trip" : "Archive trip"}
          </button>

          {confirmDelete ? (
            <div className="space-y-2 rounded-input border border-brick/30 bg-brick/5 p-3">
              <p className="text-sm text-ink">
                Delete this trip for everyone? Packing, meals, photos, and the guide go with it.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={manageBusy !== null}
                  className="flex-1 rounded-button px-3 py-2 text-sm text-ink-light transition-colors hover:bg-sand/50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={manageBusy !== null}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-button bg-brick px-3 py-2 text-sm text-bone shadow-button transition-colors hover:bg-brick/90 disabled:opacity-50"
                >
                  {manageBusy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete trip
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm text-brick transition-colors hover:bg-brick/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete trip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
