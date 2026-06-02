"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MealSlot, MealType } from "@/lib/schemas/meals";
import { ChefHat, Clock, Pencil, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useState } from "react";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  other: "Other",
};

interface MealSlotCardProps {
  slot: MealSlot;
  currentUserId: string;
  isHost: boolean;
  onJoin: (slotId: string) => void;
  onLeave: (slotId: string) => void;
  onSaveDetails: (
    slotId: string,
    fields: {
      title?: string;
      menu?: string;
      notes?: string;
      meet_time?: string | null;
      is_dining_out?: boolean;
    }
  ) => Promise<{ error?: string } | void>;
  onDelete: (slotId: string) => void;
}

export function MealSlotCard({
  slot,
  currentUserId,
  isHost,
  onJoin,
  onLeave,
  onSaveDetails,
  onDelete,
}: MealSlotCardProps) {
  const dining = slot.is_dining_out;
  const isCook = slot.cooks.some((c) => c.user_id === currentUserId);
  // Dining-out slots have no cooks, so only the host can edit them.
  const canEdit = isHost || (!dining && isCook);
  const canDelete = isHost || slot.created_by_user_id === currentUserId;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(slot.title ?? "");
  const [menu, setMenu] = useState(slot.menu ?? "");
  const [notes, setNotes] = useState(slot.notes ?? "");
  const [meetTime, setMeetTime] = useState(slot.meet_time ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function cancelEdit() {
    setTitle(slot.title ?? "");
    setMenu(slot.menu ?? "");
    setNotes(slot.notes ?? "");
    setMeetTime(slot.meet_time ?? "");
    setSaveError(null);
    setEditing(false);
  }

  async function persist(
    fields: Parameters<MealSlotCardProps["onSaveDetails"]>[1]
  ) {
    setSaving(true);
    const res = await onSaveDetails(slot.id, fields);
    setSaving(false);
    if (res && "error" in res && res.error) {
      setSaveError(res.error);
      return false;
    }
    setSaveError(null);
    return true;
  }

  async function handleSave() {
    const fields = dining
      ? { title, meet_time: meetTime.trim() || null, notes }
      : { title, menu, notes };
    if (await persist(fields)) setEditing(false);
  }

  async function handleSwitchToCooking() {
    if (await persist({ is_dining_out: false })) setEditing(false);
  }

  return (
    <li className="rounded-card border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
              {MEAL_LABELS[slot.meal_type]}
            </span>
            {dining && (
              <span className="inline-flex items-center gap-1 rounded-badge bg-brick/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-brick">
                <UtensilsCrossed className="h-2.5 w-2.5" />
                Eating out
              </span>
            )}
          </div>
          <h3 className="font-medium text-ink">{slot.title || MEAL_LABELS[slot.meal_type]}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Edit details"
              aria-label="Edit meal details"
              className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(slot.id)}
              title="Remove meal"
              aria-label="Remove meal"
              className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Read mode — dining out */}
      {dining && !editing && (
        <div className="mt-2 space-y-1">
          {slot.meet_time && (
            <p className="flex items-center gap-1.5 text-sm text-ink">
              <Clock className="h-3.5 w-3.5 text-forest" />
              Meet at {slot.meet_time}
            </p>
          )}
          {slot.notes && (
            <p className="whitespace-pre-wrap text-xs text-ink-light">{slot.notes}</p>
          )}
        </div>
      )}

      {/* Read mode — cooking: cooks + menu/notes */}
      {!dining && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {slot.cooks.length > 0 ? (
              slot.cooks.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-badge bg-sand/50 px-2 py-0.5 text-xs text-ink"
                >
                  <ChefHat className="h-3 w-3 text-forest" />
                  {c.user_name}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-light">No cooks yet</span>
            )}
          </div>

          {!editing && (slot.menu || slot.notes) && (
            <div className="mt-3 space-y-1">
              {slot.menu && <p className="whitespace-pre-wrap text-sm text-ink">{slot.menu}</p>}
              {slot.notes && (
                <p className="whitespace-pre-wrap text-xs text-ink-light">{slot.notes}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`title-${slot.id}`}>{dining ? "Place" : "Title"}</Label>
            <Input
              id={`title-${slot.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={dining ? "El Mexicano" : "Taco night"}
            />
          </div>

          {dining ? (
            <div className="space-y-1.5">
              <Label htmlFor={`meet-${slot.id}`}>Meet time</Label>
              <Input
                id={`meet-${slot.id}`}
                value={meetTime}
                onChange={(e) => setMeetTime(e.target.value)}
                placeholder="7:00 PM"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`menu-${slot.id}`}>Menu</Label>
              <textarea
                id={`menu-${slot.id}`}
                value={menu}
                onChange={(e) => setMenu(e.target.value)}
                rows={3}
                placeholder="Carnitas, rice, margaritas..."
                className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${slot.id}`}>Notes</Label>
            <textarea
              id={`notes-${slot.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Allergies, who's shopping..."
              className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {dining && isHost && (
            <button
              type="button"
              onClick={handleSwitchToCooking}
              disabled={saving}
              className="text-sm text-forest transition-colors hover:text-forest-dark disabled:opacity-50"
            >
              Switch to cooking instead
            </button>
          )}

          {saveError && <p className="text-sm text-brick">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-forest text-white hover:bg-forest-dark"
              onClick={handleSave}
              disabled={saving}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Cook sign-up toggle (cooking slots only) */}
      {!dining && (
        <div className="mt-3">
          {isCook ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => onLeave(slot.id)}
            >
              <X className="h-3.5 w-3.5" />
              Leave
            </Button>
          ) : (
            <Button
              type="button"
              className="h-8 gap-1 bg-forest text-xs text-white hover:bg-forest-dark"
              onClick={() => onJoin(slot.id)}
            >
              <ChefHat className="h-3.5 w-3.5" />
              I&apos;ll cook
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
