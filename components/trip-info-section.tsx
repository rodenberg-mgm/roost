import type { LucideIcon } from "lucide-react";

interface TripInfoSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function TripInfoSection({ icon: Icon, title, children, action }: TripInfoSectionProps) {
  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-fern" />
          <h2 className="font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
