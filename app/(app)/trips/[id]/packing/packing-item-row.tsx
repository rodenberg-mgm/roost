"use client";

import { Button } from "@/components/ui/button";
import { summarizeItem } from "@/lib/packing/summarize";
import type { PackingItem } from "@/lib/schemas/packing";
import { Check, Minus, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

interface PackingItemRowProps {
  item: PackingItem;
  currentUserId: string;
  canDelete: boolean;
  onClaim: (itemId: string, quantity: number) => void;
  onUnclaim: (itemId: string) => void;
  onToggleBrought: (claimId: string, brought: boolean) => void;
  onSetNote: (claimId: string, note: string | null) => void;
  onDelete: (itemId: string) => void;
}

/**
 * Inline editor for the current user's "what I'm bringing" note.
 * Mount with `key={claimId}` so an unclaim + reclaim re-seeds the draft.
 */
function ClaimNoteEditor({
  claimId,
  note,
  onSetNote,
}: {
  claimId: string;
  note: string | null;
  onSetNote: (claimId: string, note: string | null) => void;
}) {
  const [draft, setDraft] = useState(note ?? "");
  const dirty = draft.trim() !== (note ?? "");

  const commit = () => {
    if (!dirty) return;
    onSetNote(claimId, draft.trim() || null);
  };

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        maxLength={140}
        placeholder="What are you bringing? (optional)"
        aria-label="What are you bringing?"
        className="min-w-0 flex-1 rounded-input border border-subtle bg-page px-2 py-1 text-xs text-ink placeholder:text-ink-light/60 focus:border-forest focus:outline-none"
      />
      {dirty && (
        <button
          type="button"
          onClick={commit}
          className="shrink-0 rounded-button bg-forest px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-white transition-colors hover:bg-forest-dark"
        >
          Save
        </button>
      )}
    </div>
  );
}

export function PackingItemRow({
  item,
  currentUserId,
  canDelete,
  onClaim,
  onUnclaim,
  onToggleBrought,
  onSetNote,
  onDelete,
}: PackingItemRowProps) {
  const s = summarizeItem(item);
  const myClaim = item.claims.find((c) => c.user_id === currentUserId);

  const overClaimed = s.needed != null ? s.claimed - s.needed : 0;
  const progressLabel =
    s.needed != null
      ? `${s.claimed} of ${s.needed} claimed` +
        (overClaimed > 0 ? ` · +${overClaimed}` : "") +
        (s.packed > 0 ? ` · ${s.packed} packed` : "")
      : s.contributors.length > 0
        ? `${s.contributors.length} bringing it`
        : "Not claimed yet";

  return (
    <li className="rounded-card border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{item.title}</span>
            {s.fullyPacked && (
              <Check className="h-4 w-4 shrink-0 text-forest" aria-label="Fully packed" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-light">{progressLabel}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title="Remove item"
            aria-label={`Remove ${item.title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {s.contributors.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.contributors.map((c) => (
            <li key={c.userId} className="flex items-start gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className="text-ink">
                  {c.name}
                  {s.needed != null && c.quantity > 1 ? ` × ${c.quantity}` : ""}
                </span>
                {c.userId === currentUserId && myClaim ? (
                  <ClaimNoteEditor
                    key={myClaim.id}
                    claimId={myClaim.id}
                    note={myClaim.note}
                    onSetNote={onSetNote}
                  />
                ) : (
                  c.note && (
                    <p className="mt-0.5 break-words text-xs italic text-ink-light">
                      {c.note}
                    </p>
                  )
                )}
              </div>
              {c.userId === currentUserId && myClaim ? (
                <button
                  type="button"
                  onClick={() => onToggleBrought(myClaim.id, !c.brought)}
                  className={`flex items-center gap-1 rounded-badge px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider transition-colors ${
                    c.brought
                      ? "bg-forest/10 text-forest"
                      : "bg-sand/50 text-ink-light hover:text-forest"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  {c.brought ? "Packed" : "Mark packed"}
                </button>
              ) : (
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
                  {c.brought ? "Packed" : "Claimed"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {myClaim ? (
          <>
            {item.target_quantity != null && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onClaim(item.id, Math.max(1, myClaim.quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-6 text-center text-sm text-ink">{myClaim.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onClaim(item.id, myClaim.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => onUnclaim(item.id)}
            >
              <X className="h-3.5 w-3.5" />
              Remove my claim
            </Button>
          </>
        ) : (
          <Button
            type="button"
            className="h-8 gap-1 bg-forest text-xs text-white hover:bg-forest-dark"
            onClick={() => onClaim(item.id, 1)}
          >
            <Plus className="h-3.5 w-3.5" />
            I&apos;ll bring this
          </Button>
        )}
      </div>
    </li>
  );
}
