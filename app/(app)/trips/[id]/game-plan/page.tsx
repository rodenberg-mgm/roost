import { GamePlanList } from "./game-plan-list";
import { getGamePlan } from "@/lib/actions/game-plan";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface GamePlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePlanPage({ params }: GamePlanPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const initialTasks = await getGamePlan(id);

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
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Game Plan</h1>
        <p className="mt-1 text-sm text-ink-light">
          Claim what needs doing — tee times, tickets, reservations. Updates appear live.
        </p>
      </header>

      <GamePlanList
        tripId={id}
        initialTasks={initialTasks}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
      />
    </div>
  );
}
