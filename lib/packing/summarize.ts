import type { PackingItem } from "@/lib/schemas/packing";

export interface ItemSummary {
  needed: number | null;
  claimed: number;
  packed: number;
  surplus: number;
  fullyPacked: boolean;
  contributors: {
    userId: string;
    name: string;
    quantity: number;
    brought: boolean;
    note: string | null;
  }[];
}

export function summarizeItem(item: PackingItem): ItemSummary {
  const claimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
  const packed = item.claims.reduce((sum, c) => sum + (c.brought ? c.quantity : 0), 0);
  const needed = item.target_quantity;

  const surplus = needed != null ? Math.max(0, packed - needed) : 0;
  const fullyPacked =
    needed != null ? packed >= needed : item.claims.some((c) => c.brought);

  return {
    needed,
    claimed,
    packed,
    surplus,
    fullyPacked,
    contributors: item.claims.map((c) => ({
      userId: c.user_id,
      name: c.user_name,
      quantity: c.quantity,
      brought: c.brought,
      note: c.note,
    })),
  };
}
