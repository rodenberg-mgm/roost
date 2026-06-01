import type { LucideIcon } from "lucide-react";

interface TripInfoSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}

export function TripInfoSection({ icon: Icon, title, children, action, id }: TripInfoSectionProps) {
  return (
    <section id={id} className="scroll-mt-4 rounded-card border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/8">
            <Icon className="h-4 w-4 text-forest" />
          </div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
