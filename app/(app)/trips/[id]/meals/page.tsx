import { MealsList } from "./meals-list";
import { getMeals } from "@/lib/actions/meals";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface MealsPageProps {
  params: Promise<{ id: string }>;
}

export default async function MealsPage({ params }: MealsPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("starts_on, ends_on")
    .eq("id", id)
    .single();

  const initialSlots = await getMeals(id);

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Trip Guide
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Meals</h1>
        <p className="mt-1 text-sm text-ink-light">
          Plan who cooks what. Updates appear live for everyone.
        </p>
      </header>

      <MealsList
        tripId={id}
        initialSlots={initialSlots}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
        startsOn={trip?.starts_on ?? null}
        endsOn={trip?.ends_on ?? null}
      />
    </div>
  );
}
