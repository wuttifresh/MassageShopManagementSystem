"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/// Subscribes to live changes on the `queues` table for this branch and refreshes the dashboard's
/// server-rendered data whenever another staff member checks someone in, assigns a therapist, etc.
/// Requires a real Supabase project (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) and
/// the `queues` table added to the `supabase_realtime` publication — see prisma/ER.md. Without
/// those, this no-ops: the dashboard still works, it just won't reflect other staff's changes
/// until the next manual reload or action.
export function QueueRealtimeListener({ branchId }: { branchId: string }) {
  const router = useRouter();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.info(
        "[queue-dashboard] Supabase Realtime is not configured (NEXT_PUBLIC_SUPABASE_URL / " +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY) — live updates from other staff are disabled."
      );
      return;
    }

    const supabase = createClient(url, anonKey);
    const channel = supabase
      .channel(`queues-branch-${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues", filter: `branch_id=eq.${branchId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, router]);

  return null;
}
