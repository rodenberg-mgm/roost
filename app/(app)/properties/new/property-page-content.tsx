"use client";

import { PropertyForm } from "@/components/property-form";
import { useRouter } from "next/navigation";

export function PropertyPageContent() {
  const router = useRouter();

  return (
    <PropertyForm
      onSuccess={() => router.push("/properties")}
    />
  );
}
