"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * Subscribe to live changes for one trip. One channel per trip (`trip:{id}`).
 * `onChange` fires on any insert/update/delete to the trip's packing tables;
 * pass a STABLE callback (wrap in useCallback) or the channel will resubscribe
 * on every render. State-layer-agnostic: consumers typically invalidate a query.
 *
 * Anonymous viewers must not call this — realtime requires an authenticated
 * session (CLAUDE.md §8).
 */
export function useTripChannel(tripId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_items", filter: `trip_id=eq.${tripId}` },
        onChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_claims", filter: `trip_id=eq.${tripId}` },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, onChange]);
}
