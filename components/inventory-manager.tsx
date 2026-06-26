"use client";

import { Input } from "@/components/ui/input";
import {
  createInventoryImageUploadUrl,
  deleteInventoryItem,
  deleteSuggestedItem,
  setSuggestedProvided,
  upsertInventoryItem,
  upsertSuggestedItem,
} from "@/lib/actions/inventory";
import { uploadInventoryImage } from "@/lib/storage/client";
import {
  INVENTORY_CATEGORIES,
  categoryLabel,
  type InventoryCategory,
  type InventoryItem,
  type InventoryScope,
  type SuggestedItem,
} from "@/lib/schemas/inventory";
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

interface Props {
  scope: InventoryScope;
  parentId: string;
  initialInventory: InventoryItem[];
  initialSuggestions: SuggestedItem[];
}

/** Pull a human message out of an action error (string, {_form}, or field errors). */
function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const rec = err as Record<string, string[]>;
    return rec._form?.[0] ?? Object.values(rec)[0]?.[0] ?? "Could not save";
  }
  return "Could not save";
}

export function InventoryManager({ scope, parentId, initialInventory, initialSuggestions }: Props) {
  return (
    <div className="space-y-8">
      <InventorySection scope={scope} parentId={parentId} items={initialInventory} />
      <SuggestedSection scope={scope} parentId={parentId} items={initialSuggestions} />
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: InventoryCategory;
  onChange: (v: InventoryCategory) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InventoryCategory)}
      className="rounded-input border border-input bg-background px-2 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {INVENTORY_CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================
// Inventory
// ============================================================
function InventorySection({
  scope,
  parentId,
  items,
}: {
  scope: InventoryScope;
  parentId: string;
  items: InventoryItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add-form state
  const [category, setCategory] = useState<InventoryCategory>("other");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [detail, setDetail] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setCategory("other");
    setTitle("");
    setQuantity("");
    setDetail("");
    setImagePath(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const res = await createInventoryImageUploadUrl({ scope, parent_id: parentId, ext });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      const { path, token } = res.data!;
      await uploadInventoryImage(path, token, file, file.type || "image/jpeg");
      setImagePath(path);
      setImagePreview(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await upsertInventoryItem({
      scope,
      parent_id: parentId,
      category,
      title: title.trim(),
      quantity: quantity.trim() ? Number(quantity) : null,
      detail: detail.trim() || null,
      image_path: imagePath,
    });
    setSaving(false);
    if ("error" in res && res.error) {
      setError(errorMessage(res.error));
      return;
    }
    resetForm();
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    const res = await deleteInventoryItem(scope, id);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-ink">What&apos;s already here</h3>
        <p className="text-xs text-ink-light">
          Stuff at the place — pantry staples, life jackets (note sizes), pool noodles. Add a
          photo so people know what to look for.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-input border border-subtle bg-sand/20 px-2.5 py-2 text-sm"
            >
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="h-9 w-9 shrink-0 rounded-stamp object-cover" />
              ) : (
                <span className="h-9 w-9 shrink-0 rounded-stamp bg-sand/60" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block break-words text-ink">
                  {item.title}
                  {item.quantity != null && <span className="text-ink-light"> ×{item.quantity}</span>}
                </span>
                <span className="block text-xs text-ink-light">
                  {categoryLabel(item.category)}
                  {item.detail ? ` · ${item.detail}` : ""}
                </span>
              </span>
              <RowDelete onDelete={() => handleDelete(item.id)} label={item.title} />
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      <div className="space-y-2 rounded-input border border-subtle bg-card p-3">
        <div className="flex gap-2">
          <CategorySelect value={category} onChange={setCategory} />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Life jackets"
            aria-label="Item name"
            className="flex-1"
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Qty"
            inputMode="numeric"
            aria-label="Quantity"
            className="w-20"
          />
          <Input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Youth S–L ×4, Adult ×6"
            aria-label="Details / sizes"
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {imagePreview ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="h-9 w-9 rounded-stamp object-cover" />
              <button
                type="button"
                onClick={() => {
                  setImagePath(null);
                  setImagePreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs text-ink-light hover:text-brick"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-button border border-subtle px-3 py-1.5 text-xs text-ink-light transition-colors hover:bg-sand/40 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : "Add photo"}
            </button>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!title.trim() || saving || uploading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-button bg-forest px-3 py-1.5 text-sm text-bone transition-colors hover:bg-forest-dark disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-brick">{error}</p>}
    </div>
  );
}

// ============================================================
// Suggested to bring
// ============================================================
function SuggestedSection({
  scope,
  parentId,
  items,
}: {
  scope: InventoryScope;
  parentId: string;
  items: SuggestedItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<InventoryCategory>("other");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await upsertSuggestedItem({ scope, parent_id: parentId, category, title: title.trim() });
    setSaving(false);
    if ("error" in res && res.error) {
      setError(errorMessage(res.error));
      return;
    }
    setTitle("");
    setCategory("other");
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    const res = await deleteSuggestedItem(scope, id);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function toggleProvided(id: string, provided: boolean) {
    const res = await setSuggestedProvided(id, provided);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-ink">Suggested to bring</h3>
        <p className="text-xs text-ink-light">
          Reminders for everyone (sunscreen, water shoes). Not claimable — just a nudge.
          {scope === "trip" && " Mark anything the place already provides."}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-input border border-subtle bg-sand/20 px-2.5 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className={`block break-words text-ink ${item.provided ? "line-through opacity-60" : ""}`}>
                  {item.title}
                </span>
                <span className="block text-xs text-ink-light">{categoryLabel(item.category)}</span>
              </span>
              {scope === "trip" && (
                <button
                  type="button"
                  onClick={() => toggleProvided(item.id, !item.provided)}
                  aria-pressed={item.provided}
                  className={`inline-flex items-center gap-1 rounded-stamp px-2 py-1 font-mono text-[0.55rem] uppercase tracking-wider transition-colors ${
                    item.provided
                      ? "bg-sage/40 text-forest"
                      : "border border-subtle text-ink-light hover:bg-sand/40"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  Provided
                </button>
              )}
              <RowDelete onDelete={() => handleDelete(item.id)} label={item.title} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 rounded-input border border-subtle bg-card p-3">
        <CategorySelect value={category} onChange={setCategory} />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Sunscreen"
          aria-label="Suggested item"
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!title.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-button bg-forest px-3 py-1.5 text-sm text-bone transition-colors hover:bg-forest-dark disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {error && <p className="text-xs text-brick">{error}</p>}
    </div>
  );
}

function RowDelete({ onDelete, label }: { onDelete: () => void; label: string }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-button bg-brick/10 text-brick"
          aria-label={`Confirm remove ${label}`}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex h-7 w-7 items-center justify-center rounded-button text-ink-light hover:bg-sand/50"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Remove ${label}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
