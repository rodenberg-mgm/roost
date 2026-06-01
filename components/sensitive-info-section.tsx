"use client";

import { SensitiveField } from "@/components/sensitive-field";
import { RevealDialog } from "@/components/reveal-dialog";
import { TripInfoSection } from "@/components/trip-info-section";
import { Eye, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SensitiveData {
  wifi_ssid: string | null;
  wifi_password: string | null;
  door_code: string | null;
  gate_code: string | null;
  address_line: string | null;
  postal_code: string | null;
  parking_notes: string | null;
}

interface SensitiveInfoSectionProps {
  tripId: string;
  userEmail: string;
  userRole: string;
  requirePin: boolean;
  /** Actual values — populated only when the viewer is allowed to read them. */
  initialData: SensitiveData | null;
  /** True if any sensitive field is filled in (presence, computed server-side
   *  via service-role). Lets us show the gated prompt to a guest who can't yet
   *  read the values themselves. */
  hasSensitiveData: boolean;
  hasAccess: boolean;
}

export function SensitiveInfoSection({
  tripId,
  userEmail,
  userRole,
  requirePin,
  initialData,
  hasSensitiveData,
  hasAccess,
}: SensitiveInfoSectionProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(hasAccess);
  const [showDialog, setShowDialog] = useState(false);

  const isHost = userRole === "host" || userRole === "co-host";
  const canSee = isHost || revealed;

  const data = initialData;

  // Nothing entered yet: hosts get a discoverable "Add" prompt; guests see nothing.
  if (!hasSensitiveData) {
    if (!isHost) return null;
    return (
      <TripInfoSection icon={Lock} title="Wifi, Codes & Address">
        <Link
          href={`/trips/${tripId}/edit`}
          className="inline-flex items-center gap-1.5 text-sm text-forest transition-colors hover:text-forest-dark"
        >
          <Plus className="h-4 w-4" />
          Add wifi, codes &amp; address
        </Link>
      </TripInfoSection>
    );
  }

  function handleRevealRequest() {
    if (isHost) {
      setRevealed(true);
      return;
    }
    setShowDialog(true);
  }

  function handleRevealed() {
    setRevealed(true);
    setShowDialog(false);
    // Re-render server-side: the sensitive grant now exists, so RLS releases
    // the actual values into initialData on the next pass.
    router.refresh();
  }

  // Data exists but this viewer can't read it yet: single gated reveal prompt.
  if (!canSee || !data) {
    return (
      <>
        <TripInfoSection icon={Lock} title="Wifi, Codes & Address">
          <button
            type="button"
            onClick={handleRevealRequest}
            className="flex items-center gap-2 text-sm text-forest transition-colors hover:text-forest-dark"
          >
            <span className="font-mono tracking-wider">••••••</span>
            <span>Tap to reveal wifi, codes &amp; address</span>
            <Eye className="h-3.5 w-3.5" />
          </button>
        </TripInfoSection>

        {showDialog && (
          <RevealDialog
            tripId={tripId}
            userEmail={userEmail}
            requirePin={requirePin}
            onRevealed={handleRevealed}
            onClose={() => setShowDialog(false)}
          />
        )}
      </>
    );
  }

  return (
    <TripInfoSection
      icon={Lock}
      title="Wifi, Codes & Address"
      action={
        isHost ? (
          <Link
            href={`/trips/${tripId}/edit`}
            className="font-mono text-[0.65rem] uppercase tracking-wider text-forest transition-colors hover:text-forest-dark"
          >
            Edit
          </Link>
        ) : undefined
      }
    >
      <div className="divide-y divide-sand/30">
        <SensitiveField label="Wifi" value={data.wifi_ssid} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Password" value={data.wifi_password} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Door code" value={data.door_code} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Gate code" value={data.gate_code} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Address" value={data.address_line} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Postal code" value={data.postal_code} revealed onRevealRequest={handleRevealRequest} />
        <SensitiveField label="Parking" value={data.parking_notes} revealed onRevealRequest={handleRevealRequest} />
      </div>
    </TripInfoSection>
  );
}
