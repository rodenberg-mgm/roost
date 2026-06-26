import { INVENTORY_CATEGORIES, categoryLabel } from "@/lib/schemas/inventory";
import type { InventoryItem, SuggestedItem } from "@/lib/schemas/inventory";
import { Check } from "lucide-react";

const CATEGORY_ORDER: string[] = INVENTORY_CATEGORIES.map((c) => c.value);

function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = CATEGORY_ORDER.includes(item.category) ? item.category : "other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!]);
}

/** Read-only "What's already here" — inventory grouped by category with photos. */
export function InventoryBrowse({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) return null;
  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {groups.map(([category, rows]) => (
        <div key={category}>
          <h4 className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
            {categoryLabel(category)}
          </h4>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 rounded-input border border-subtle bg-sand/20 px-2.5 py-2 text-sm text-ink"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-stamp object-cover"
                  />
                ) : (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest/40" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block break-words">
                    {item.title}
                    {item.quantity != null && (
                      <span className="text-ink-light"> ×{item.quantity}</span>
                    )}
                  </span>
                  {item.detail && (
                    <span className="block text-xs text-ink-light">{item.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Read-only "Suggested to bring" — grouped by category, with a provided badge. */
export function SuggestedBrowse({ items }: { items: SuggestedItem[] }) {
  if (items.length === 0) return null;
  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {groups.map(([category, rows]) => (
        <div key={category}>
          <h4 className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
            {categoryLabel(category)}
          </h4>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-1.5 text-sm text-ink"
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                <span className={item.provided ? "text-ink-light line-through" : ""}>
                  {item.title}
                </span>
                {item.provided && (
                  <span className="inline-flex items-center gap-0.5 rounded-stamp bg-sage/30 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-forest">
                    <Check className="h-2.5 w-2.5" />
                    Provided
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
