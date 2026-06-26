"use client";

import { addSuggestionToMyHousehold } from "@/lib/actions/households";
import { INVENTORY_CATEGORIES, categoryLabel, type SuggestedItem } from "@/lib/schemas/inventory";
import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";

const CATEGORY_ORDER: string[] = INVENTORY_CATEGORIES.map((c) => c.value);

function groupByCategory(items: SuggestedItem[]): [string, SuggestedItem[]][] {
  const map = new Map<string, SuggestedItem[]>();
  for (const item of items) {
    const key = CATEGORY_ORDER.includes(item.category) ? item.category : "other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!]);
}

/**
 * Interactive "Suggested to bring" for trip members: each non-provided item can
 * be added to the viewer's household packing list in one tap. Used on the trip
 * guide; anonymous viewers get the read-only SuggestedBrowse instead.
 */
export function SuggestedAddList({ tripId, items }: { tripId: string; items: SuggestedItem[] }) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addToMyList(item: SuggestedItem) {
    setBusy(item.id);
    setError(null);
    const res = await addSuggestionToMyHousehold({
      trip_id: tripId,
      suggestion_item_id: item.id,
      title: item.title,
      category: item.category,
    });
    setBusy(null);
    if ("error" in res && res.error) {
      setError(typeof res.error === "string" ? res.error : "Couldn't add");
      return;
    }
    setAdded((prev) => new Set(prev).add(item.id));
  }

  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-brick">{error}</p>}
      {groups.map(([category, rows]) => (
        <div key={category}>
          <h4 className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
            {categoryLabel(category)}
          </h4>
          <ul className="space-y-1">
            {rows.map((item) => {
              const isAdded = added.has(item.id);
              return (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={`min-w-0 flex-1 ${item.provided ? "text-ink-light line-through" : "text-ink"}`}>
                    {item.title}
                  </span>
                  {item.provided ? (
                    <span className="inline-flex items-center gap-0.5 rounded-stamp bg-sage/30 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-forest">
                      <Check className="h-2.5 w-2.5" />
                      Provided
                    </span>
                  ) : isAdded ? (
                    <span className="inline-flex items-center gap-1 text-xs text-forest">
                      <Check className="h-3.5 w-3.5" />
                      On your list
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToMyList(item)}
                      disabled={busy === item.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-button border border-subtle px-2 py-1 text-xs text-forest transition-colors hover:bg-sand/40 disabled:opacity-50"
                    >
                      {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add to my list
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
