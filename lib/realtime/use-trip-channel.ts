"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * Subscribe to live changes for one trip. One channel per trip (`trip:{id}`).
 * `tables` is the list of trip-scoped tables to watch (filtered by `trip_id`);
 * pass a STABLE reference (a module-level constant) so the effect doesn't
 * resubscribe each render. `onChange` fires on any insert/update/delete; pass a
 * STABLE callback (useCallback). State-layer-agnostic: consumers typically
 * invalidate a query.
 *
 * Anonymous viewers must not call this — realtime requires an authenticated
 * session (CLAUDE.md §8).
 */
export function useTripChannel(
  tripId: string,
  tables: string[],
  onChange: () => void
) {
  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`trip:${tripId}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        onChange
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, tables, onChange]);
}
