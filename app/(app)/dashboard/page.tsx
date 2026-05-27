import { EmptyState } from "@/components/empty-state";
import { Map } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">My Trips</h1>
      </header>
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning your next group stay, or join one with an invite link."
        action={{ label: "Start a Trip", href: "/trips/new" }}
      />
    </div>
  );
}
