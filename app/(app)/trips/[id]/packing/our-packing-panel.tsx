"use client";

import { Input } from "@/components/ui/input";
import {
  addHouseholdItem,
  addHouseholdMember,
  deleteHouseholdItem,
  getAddableMembers,
  getHouseholdPacking,
  getMyClaimedSupplies,
  getOrCreateMyHousehold,
  removeHouseholdMember,
  renameHousehold,
  toggleHouseholdPacked,
} from "@/lib/actions/households";
import { INVENTORY_CATEGORIES, type InventoryCategory } from "@/lib/schemas/inventory";
import type { Household, HouseholdPackingItem } from "@/lib/schemas/household";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, Loader2, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Props {
  tripId: string;
  currentUserId: string;
}

export function OurPackingPanel({ tripId, currentUserId }: Props) {
  const queryClient = useQueryClient();

  // Creates a household-of-one on first open via the leak-safe rpc. Throwing on
  // error lets react-query surface it without a setState-in-effect.
  const householdQuery = useQuery({
    queryKey: ["household", tripId],
    queryFn: async () => {
      const res = await getOrCreateMyHousehold(tripId);
      if ("error" in res) throw new Error(res.error);
      return res.household;
    },
  });

  const household = householdQuery.data;

  const itemsQuery = useQuery({
    queryKey: ["household-packing", household?.id],
    queryFn: () => getHouseholdPacking(household!.id),
    enabled: !!household,
  });
  const items = itemsQuery.data ?? [];

  // Read-only mirror of what the viewer has claimed in Shared Supplies.
  const claimsQuery = useQuery({
    queryKey: ["my-claimed-supplies", tripId],
    queryFn: () => getMyClaimedSupplies(tripId),
  });
  const claims = claimsQuery.data ?? [];

  const refreshItems = () =>
    queryClient.invalidateQueries({ queryKey: ["household-packing", household?.id] });
  const refreshHousehold = () =>
    queryClient.invalidateQueries({ queryKey: ["household", tripId] });

  if (householdQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-card border bg-card p-10 text-ink-light">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (householdQuery.isError || !household) {
    return (
      <p className="rounded-card border bg-card p-5 text-sm text-brick">
        {householdQuery.error instanceof Error ? householdQuery.error.message : "Couldn't load your list."}
      </p>
    );
  }

  const packedCount = items.filter((i) => i.packed).length;

  return (
    <div className="space-y-4">
      <HouseholdHeader
        household={household}
        tripId={tripId}
        currentUserId={currentUserId}
        onChanged={refreshHousehold}
      />

      {claims.length > 0 && <ClaimedStrip tripId={tripId} claims={claims} />}

      <div className="rounded-card border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-ink">Packing checklist</h3>
          {items.length > 0 && (
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
              {packedCount}/{items.length} packed
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-ink-light">
            Private to your household. Add clothes, toiletries, kids&apos; stuff — or pull from the
            suggestions on the trip guide.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={async (packed) => {
                  await toggleHouseholdPacked(item.id, packed);
                  refreshItems();
                }}
                onDelete={async () => {
                  await deleteHouseholdItem(item.id);
                  refreshItems();
                }}
              />
            ))}
          </ul>
        )}

        <AddItemForm householdId={household.id} tripId={tripId} onAdded={refreshItems} />
      </div>
    </div>
  );
}

/**
 * Read-only "Also bringing for the group" — mirrors the viewer's Shared Supplies
 * claims so everything they need to pack is visible in one place. Managed from
 * Shared Supplies, not here (the claim is the source of truth).
 */
function ClaimedStrip({
  tripId,
  claims,
}: {
  tripId: string;
  claims: { item_id: string; title: string; quantity: number; brought: boolean }[];
}) {
  return (
    <div className="rounded-card border border-subtle bg-sand/20 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Boxes className="h-4 w-4 text-forest" />
        <h3 className="text-sm font-semibold text-ink">Also bringing for the group</h3>
      </div>
      <ul className="space-y-1">
        {claims.map((c) => (
          <li key={c.item_id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 text-ink">
              {c.title}
              {c.quantity > 1 && <span className="text-ink-light"> ×{c.quantity}</span>}
            </span>
            {c.brought ? (
              <span className="inline-flex items-center gap-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-forest">
                <Check className="h-3 w-3" />
                Packed
              </span>
            ) : (
              <span className="font-mono text-[0.55rem] uppercase tracking-wider text-ink-light">
                To pack
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href={`/trips/${tripId}/packing`}
        className="mt-2 inline-block font-mono text-[0.6rem] uppercase tracking-wider text-forest hover:text-forest-dark"
      >
        Manage in Shared Supplies →
      </Link>
    </div>
  );
}

function HouseholdHeader({
  household,
  tripId,
  currentUserId,
  onChanged,
}: {
  household: Household;
  tripId: string;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(household.name);
  const [addingMember, setAddingMember] = useState(false);
  const [addable, setAddable] = useState<{ user_id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    setBusy(true);
    await renameHousehold(household.id, name.trim() || household.name);
    setBusy(false);
    setEditingName(false);
    onChanged();
  }

  async function openAddMember() {
    setAddingMember(true);
    setAddable(await getAddableMembers(tripId, household.id));
  }

  async function add(userId: string) {
    setBusy(true);
    setError(null);
    const res = await addHouseholdMember(household.id, tripId, userId);
    setBusy(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setAddingMember(false);
    onChanged();
  }

  async function remove(userId: string) {
    setBusy(true);
    await removeHouseholdMember(household.id, userId);
    setBusy(false);
    onChanged();
  }

  return (
    <div className="rounded-card border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-forest" />
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" autoFocus />
            <button type="button" onClick={saveName} disabled={busy} className="text-forest" aria-label="Save name">
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(household.name);
                setEditingName(false);
              }}
              className="text-ink-light"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 font-semibold text-ink">{household.name}</h3>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-ink-light hover:text-forest"
              aria-label="Rename household"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {household.members.map((m) => (
          <span
            key={m.user_id}
            className="inline-flex items-center gap-1 rounded-stamp bg-sand/50 px-2 py-0.5 text-xs text-ink"
          >
            {m.name}
            {m.user_id === currentUserId && <span className="text-ink-light">(you)</span>}
            {household.members.length > 1 && (
              <button
                type="button"
                onClick={() => remove(m.user_id)}
                aria-label={`Remove ${m.name}`}
                className="text-ink-light hover:text-brick"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={openAddMember}
          className="inline-flex items-center gap-1 rounded-stamp border border-subtle px-2 py-0.5 text-xs text-forest hover:bg-sand/40"
        >
          <UserPlus className="h-3 w-3" />
          Add
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-light">
        Share this list with your partner or family — only people here can see it.
      </p>

      {addingMember && (
        <div className="mt-3 rounded-input border border-subtle bg-page p-2">
          {error && <p className="mb-1.5 text-xs text-brick">{error}</p>}
          {addable.length === 0 ? (
            <p className="text-xs text-ink-light">No one else to add right now.</p>
          ) : (
            <ul className="space-y-1">
              {addable.map((m) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    onClick={() => add(m.user_id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-button px-2 py-1.5 text-left text-sm text-ink hover:bg-sand/50 disabled:opacity-50"
                  >
                    {m.name}
                    <Plus className="h-3.5 w-3.5 text-forest" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setAddingMember(false)}
            className="mt-1 text-xs text-ink-light hover:text-ink"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: HouseholdPackingItem;
  onToggle: (packed: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.packed}
        onClick={() => onToggle(!item.packed)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
          item.packed ? "border-forest bg-forest text-bone" : "border-ink-light/40 bg-card"
        }`}
      >
        {item.packed && <Check className="h-3.5 w-3.5" />}
      </button>
      <span className={`min-w-0 flex-1 break-words ${item.packed ? "text-ink-light line-through" : "text-ink"}`}>
        {item.title}
        {item.quantity != null && <span className="text-ink-light"> ×{item.quantity}</span>}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${item.title}`}
        className="text-ink-light transition-colors hover:text-brick"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddItemForm({
  householdId,
  tripId,
  onAdded,
}: {
  householdId: string;
  tripId: string;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("other");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    const n = parseInt(qty, 10);
    await addHouseholdItem({
      household_id: householdId,
      trip_id: tripId,
      title: title.trim(),
      category,
      quantity: n > 0 ? n : null,
    });
    setSaving(false);
    setTitle("");
    setQty("");
    onAdded();
  }

  return (
    <div className="mt-3 flex gap-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as InventoryCategory)}
        className="rounded-input border border-input bg-background px-2 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Category"
      >
        {INVENTORY_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Swimsuit, charger, kids' towels…"
        aria-label="Add to your list"
        className="flex-1"
      />
      <Input
        value={qty}
        onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Qty"
        inputMode="numeric"
        aria-label="Quantity (optional)"
        className="w-16"
      />
      <button
        type="button"
        onClick={add}
        disabled={!title.trim() || saving}
        className="inline-flex items-center gap-1.5 rounded-button bg-forest px-3 py-1.5 text-sm text-bone transition-colors hover:bg-forest-dark disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </button>
    </div>
  );
}
