"use client";

import { SensitiveField } from "@/components/sensitive-field";
import { RevealDialog } from "@/components/reveal-dialog";
import { TripInfoSection } from "@/components/trip-info-section";
import { Lock, Plus } from "lucide-react";
import Link from "next/link";
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
  initialData: SensitiveData | null;
  hasAccess: boolean;
}

export function SensitiveInfoSection({
  tripId,
  userEmail,
  userRole,
  requirePin,
  initialData,
  hasAccess,
}: SensitiveInfoSectionProps) {
  const [revealed, setRevealed] = useState(hasAccess);
  const [showDialog, setShowDialog] = useState(false);

  const isHost = userRole === "host" || userRole === "co-host";
  const canSee = isHost || revealed;

  const data = initialData;
  const hasAnyData = data && Object.values(data).some((v) => v !== null && v !== "");

  // Empty: hosts get a discoverable "Add" prompt; guests see nothing.
  if (!hasAnyData) {
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

  return (
    <>
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
        {data && (
          <div className="divide-y divide-sand/30">
            <SensitiveField label="Wifi" value={data.wifi_ssid} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Password" value={data.wifi_password} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Door code" value={data.door_code} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Gate code" value={data.gate_code} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Address" value={data.address_line} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Postal code" value={data.postal_code} revealed={canSee} onRevealRequest={handleRevealRequest} />
            <SensitiveField label="Parking" value={data.parking_notes} revealed={canSee} onRevealRequest={handleRevealRequest} />
          </div>
        )}
      </TripInfoSection>

      {showDialog && (
        <RevealDialog
          tripId={tripId}
          userEmail={userEmail}
          requirePin={requirePin}
          onRevealed={() => {
            setRevealed(true);
            setShowDialog(false);
          }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
