"use client";

import { cn } from "@/lib/utils";
import { Map, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "My Trips", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sand bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-sm items-center justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[0.65rem] font-medium uppercase tracking-wider transition-colors",
                isActive
                  ? "text-forest"
                  : "text-ink-light/60 hover:text-ink-light"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-forest")} />
              <span>{label}</span>
              {isActive && (
                <div className="absolute top-0 h-[2px] w-10 rounded-full bg-forest" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
