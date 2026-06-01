"use client";

import { PropertyForm } from "@/components/property-form";
import type { CreatePropertyInput } from "@/lib/schemas/property";
import { useRouter } from "next/navigation";

export function EditPropertyContent({
  propertyId,
  initialValues,
}: {
  propertyId: string;
  initialValues: Partial<CreatePropertyInput>;
}) {
  const router = useRouter();

  return (
    <PropertyForm
      propertyId={propertyId}
      initialValues={initialValues}
      onSuccess={() => router.push("/properties")}
      onCancel={() => router.push("/properties")}
    />
  );
}
