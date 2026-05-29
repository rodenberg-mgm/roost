import { cn } from "@/lib/utils";

type StampVariant = "brick" | "forest" | "kraft";

interface StampBadgeProps {
  children: React.ReactNode;
  variant?: StampVariant;
  className?: string;
}

export function StampBadge({ children, variant = "brick", className }: StampBadgeProps) {
  return (
    <span
      className={cn(
        "stamp",
        variant === "forest" && "stamp--forest",
        variant === "kraft" && "stamp--kraft",
        className,
      )}
    >
      {children}
    </span>
  );
}
