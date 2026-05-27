import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sand/50">
        <Icon className="h-8 w-8 text-roost" />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-light">{description}</p>
      {action && (
        <Button asChild className="mt-6 bg-fern text-white hover:bg-fern-dark">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
