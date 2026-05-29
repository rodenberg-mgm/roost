"use client";

import { Button } from "@/components/ui/button";
import { PropertyForm } from "@/components/property-form";
import { Home, Plus } from "lucide-react";
import { useState } from "react";

interface Property {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
}

interface PropertyPickerProps {
  properties: Property[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function PropertyPicker({ properties, selectedId, onSelect }: PropertyPickerProps) {
  const [showCreate, setShowCreate] = useState(false);

  if (showCreate) {
    return (
      <div className="rounded-card border border-sand p-4">
        <PropertyForm
          inline
          onSuccess={(id) => {
            onSelect(id);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(selectedId === p.id ? null : p.id)}
              className={`flex w-full items-center gap-3 rounded-card border p-3 text-left text-sm transition-colors ${
                selectedId === p.id
                  ? "border-forest bg-forest/5 text-ink"
                  : "border-sand bg-card text-ink-light hover:border-forest/30"
              }`}
            >
              <Home className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium text-ink">{p.name}</span>
                {(p.city || p.region) && (
                  <span className="ml-2 text-xs text-ink-light">
                    {[p.city, p.region].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowCreate(true)}
        className="w-full"
      >
        <Plus className="mr-1 h-4 w-4" />
        {properties.length > 0 ? "Add new property" : "Link a property"}
      </Button>
    </div>
  );
}
