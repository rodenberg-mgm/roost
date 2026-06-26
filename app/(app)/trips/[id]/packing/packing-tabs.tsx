"use client";

import { PackingList } from "./packing-list";
import { OurPackingPanel } from "./our-packing-panel";
import type { PackingItem } from "@/lib/schemas/packing";
import { useState } from "react";

type Tab = "shared" | "ours";

interface Props {
  tripId: string;
  currentUserId: string;
  isHost: boolean;
  initialPacking: PackingItem[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "shared", label: "Shared Supplies" },
  { key: "ours", label: "Our Packing" },
];

export function PackingTabs({ tripId, currentUserId, isHost, initialPacking }: Props) {
  const [tab, setTab] = useState<Tab>("shared");

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 rounded-input bg-sand/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-[0.7rem] px-2 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === t.key ? "bg-card text-forest shadow-button" : "text-ink-light hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "shared" && (
        <PackingList
          tripId={tripId}
          initialItems={initialPacking}
          currentUserId={currentUserId}
          isHost={isHost}
        />
      )}
      {tab === "ours" && <OurPackingPanel tripId={tripId} currentUserId={currentUserId} />}
    </div>
  );
}
