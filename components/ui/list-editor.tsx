"use client";

import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface ListEditorProps {
  /** Name of the hidden input; its value is JSON.stringify(items). */
  name: string;
  initialItems?: string[];
  placeholder?: string;
  /** Used for the add input + button aria-labels, e.g. "Add a house rule". */
  addLabel?: string;
  maxItems?: number;
  maxItemLength?: number;
}

export function ListEditor({
  name,
  initialItems = [],
  placeholder,
  addLabel = "Add an item",
  maxItems = 50,
  maxItemLength = 200,
}: ListEditorProps) {
  const [items, setItems] = useState<string[]>(initialItems);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || items.length >= maxItems) return;
    setItems((prev) => [...prev, v.slice(0, maxItemLength)]);
    setDraft("");
  }

  function removeAt(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} readOnly />

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-input border bg-sand/30 px-3 py-2 text-sm text-ink"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest/50" />
              <span className="min-w-0 flex-1 break-words">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => removeAt(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={addLabel}
          maxLength={maxItemLength}
          className="flex-1"
        />
        <button
          type="button"
          aria-label={addLabel}
          onClick={add}
          disabled={!draft.trim() || items.length >= maxItems}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-forest text-bone transition-colors hover:bg-forest-dark disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
