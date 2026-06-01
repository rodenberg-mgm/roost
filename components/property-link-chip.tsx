import { Home, Pencil } from "lucide-react";
import Link from "next/link";

interface PropertyLinkChipProps {
  propertyId: string;
  propertyName: string;
  /** Show the "Edit property" action — only when the viewer owns the property. */
  canEdit: boolean;
}

/**
 * Host/co-host affordance on the trip guide: shows which Property a trip was
 * linked from. Editing the property does not change this trip (copy-on-link,
 * §3.3) — it's a jump-off, not a sync.
 */
export function PropertyLinkChip({
  propertyId,
  propertyName,
  canEdit,
}: PropertyLinkChipProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-subtle bg-sand/40 px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink-light">
        <Home className="h-4 w-4 shrink-0 text-forest" />
        <span className="truncate">
          Linked to <span className="font-medium text-ink">{propertyName}</span>
        </span>
      </span>
      {canEdit && (
        <Link
          href={`/properties/${propertyId}/edit`}
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wider text-forest transition-colors hover:text-forest-dark"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit property
        </Link>
      )}
    </div>
  );
}
