import { EditPropertyContent } from "./edit-property-content";
import { InventoryManager } from "@/components/inventory-manager";
import { getProperty } from "@/lib/actions/properties";
import { getInventory, getSuggestions } from "@/lib/actions/inventory";
import type { CreatePropertyInput } from "@/lib/schemas/property";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params;
  const result = await getProperty(id);

  // Not found, deleted, or not owned by the current user (RLS-gated read).
  if (!result) {
    redirect("/properties");
  }

  const { property, sensitive } = result;

  const [inventory, suggestions] = await Promise.all([
    getInventory("property", id),
    getSuggestions("property", id),
  ]);

  const initialValues: Partial<CreatePropertyInput> = {
    name: property.name,
    city: property.city ?? undefined,
    region: property.region ?? undefined,
    house_rules: property.house_rules ?? undefined,
    local_tips: property.local_tips ?? undefined,
    wifi_ssid: sensitive?.wifi_ssid ?? undefined,
    wifi_password: sensitive?.wifi_password ?? undefined,
    door_code: sensitive?.door_code ?? undefined,
    gate_code: sensitive?.gate_code ?? undefined,
    address_line: sensitive?.address_line ?? undefined,
    postal_code: sensitive?.postal_code ?? undefined,
    parking_notes: sensitive?.parking_notes ?? undefined,
  };

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/properties"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink">Edit Property</h1>
        <p className="mt-1 text-sm text-ink-light">
          Changes apply to future trips you link. Existing trips keep their own copy.
        </p>
      </header>
      <div className="rounded-card border bg-card p-6 shadow-card">
        <EditPropertyContent propertyId={id} initialValues={initialValues} />
      </div>

      <div className="mt-4 rounded-card border bg-card p-6 shadow-card">
        <InventoryManager
          scope="property"
          parentId={id}
          initialInventory={inventory}
          initialSuggestions={suggestions}
        />
      </div>
    </div>
  );
}
