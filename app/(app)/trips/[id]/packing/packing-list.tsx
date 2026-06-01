"use client";

import { PackingItemRow } from "./packing-item-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPackingItem,
  claimItem,
  deletePackingItem,
  getPacking,
  setBrought,
  unclaimItem,
} from "@/lib/actions/packing";
import type { PackingItem } from "@/lib/schemas/packing";
import { useTripChannel } from "@/lib/realtime/use-trip-channel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { useCallback, useState } from "react";

interface PackingListProps {
  tripId: string;
  initialItems: PackingItem[];
  currentUserId: string;
  isHost: boolean;
}

export function PackingList({
  tripId,
  initialItems,
  currentUserId,
  isHost,
}: PackingListProps) {
  const queryClient = useQueryClient();
  const queryKey = ["packing", tripId];

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: () => getPacking(tripId),
    initialData: initialItems,
    // Treat server-hydrated data as immediately stale so realtime invalidations
    // refetch on remount instead of serving 30s-old data.
    initialDataUpdatedAt: 0,
  });

  // Stable callback so the realtime channel doesn't resubscribe each render.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["packing", tripId] });
  }, [queryClient, tripId]);

  useTripChannel(tripId, invalidate);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["packing", tripId] });

  const claim = useMutation({
    mutationFn: (v: { itemId: string; quantity: number }) =>
      claimItem({ item_id: v.itemId, quantity: v.quantity }),
    onSettled: refetch,
  });
  const unclaim = useMutation({
    mutationFn: (itemId: string) => unclaimItem(itemId),
    onSettled: refetch,
  });
  const brought = useMutation({
    mutationFn: (v: { claimId: string; brought: boolean }) =>
      setBrought({ claim_id: v.claimId, brought: v.brought }),
    onSettled: refetch,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => deletePackingItem(itemId),
    onSettled: refetch,
  });

  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [adding, setAdding] = useState(false);

  const [addError, setAddError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: async () => {
      const n = parseInt(qty, 10);
      const res = await addPackingItem({
        trip_id: tripId,
        title: title.trim(),
        target_quantity: n > 0 ? n : null,
      });
      if ("error" in res && res.error) {
        const err = res.error as unknown;
        const msg =
          typeof err === "string"
            ? err
            : (err as { _form?: string[] })._form?.[0] ?? "Couldn't add item";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      setTitle("");
      setQty("");
      setAdding(false);
      setAddError(null);
    },
    onError: (e: Error) => setAddError(e.message),
    onSettled: refetch,
  });

  return (
    <div className="space-y-4">
      {/* Add item */}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
          className="rounded-card border bg-card p-4 shadow-card"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pack-title">Item</Label>
              <Input
                id="pack-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sunscreen, firewood, wine..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-qty">How many needed? (optional)</Label>
              <Input
                id="pack-qty"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Leave blank for a single grab-it item"
              />
            </div>
            {addError && <p className="text-sm text-brick">{addError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-forest text-white hover:bg-forest-dark"
                disabled={!title.trim() || add.isPending}
              >
                Add item
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full gap-1.5 bg-forest text-white hover:bg-forest-dark"
        >
          <Plus className="h-4 w-4" />
          Add packing item
        </Button>
      )}

      {/* List or empty state */}
      {items.length === 0 ? (
        <div className="topo-bg rounded-card border bg-card p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-sage" />
          <h2 className="mt-3 font-semibold text-ink">Nothing on the list yet</h2>
          <p className="mt-1 text-sm text-ink-light">
            Add what the group needs to bring — everyone can claim items.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <PackingItemRow
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              canDelete={isHost || item.created_by_user_id === currentUserId}
              onClaim={(itemId, quantity) => claim.mutate({ itemId, quantity })}
              onUnclaim={(itemId) => unclaim.mutate(itemId)}
              onToggleBrought={(claimId, b) => brought.mutate({ claimId, brought: b })}
              onDelete={(itemId) => remove.mutate(itemId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
