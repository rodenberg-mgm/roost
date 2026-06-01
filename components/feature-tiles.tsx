import {
  ScrollText,
  Users,
  Package,
  UtensilsCrossed,
  Image as ImageIcon,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface Tile {
  label: string;
  icon: LucideIcon;
  /** in-page anchor (built sections) */
  href?: string;
  /** roadmap features not yet built */
  soon?: boolean;
}

/**
 * Trip "table of contents" grid shown at the top of the Trip Guide.
 * Built sections link to in-page anchors; roadmap features (v1.1+) render
 * with a "Soon" pill and are non-interactive — honest about what ships today.
 */
export function FeatureTiles({ tripId }: { tripId: string }) {
  const tiles: Tile[] = [
    { label: "Trip Info", icon: ScrollText, href: `/trips/${tripId}#trip-info` },
    { label: "Guests", icon: Users, href: `/trips/${tripId}#guests` },
    { label: "Packing", icon: Package, href: `/trips/${tripId}/packing` },
    { label: "Meals", icon: UtensilsCrossed, soon: true },
    { label: "Photos", icon: ImageIcon, soon: true },
    { label: "Guestbook", icon: BookOpen, soon: true },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {tiles.map(({ label, icon: Icon, href, soon }) => {
        const inner = (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/8">
              <Icon className="h-[18px] w-[18px] text-forest" />
            </div>
            <span className="font-display text-[0.7rem] font-semibold uppercase tracking-wide text-ink">
              {label}
            </span>
            {soon && (
              <span className="rounded-badge bg-sand px-1.5 py-px font-mono text-[0.55rem] uppercase tracking-wider text-ink-light/70">
                Soon
              </span>
            )}
          </>
        );

        const base =
          "flex flex-col items-center gap-1.5 rounded-card border bg-card p-3 text-center shadow-card";

        return soon || !href ? (
          <div key={label} className={`${base} opacity-70`}>
            {inner}
          </div>
        ) : (
          <Link
            key={label}
            href={href}
            className={`${base} transition-shadow hover:shadow-card-hover`}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
