import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to competition_matches (and optionally competitions / entries / podium).
 * Invalidates the given query keys so stations stay live without tight polling.
 */
export function useCompetitionRealtime(
  competitionId: string | null | undefined,
  queryKeys: QueryKey[],
  opts?: {
    includeCompetition?: boolean;
    includeEntries?: boolean;
    includePodium?: boolean;
  },
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!competitionId) return;

    const channel = supabase.channel(`rt:comp:${competitionId}`);

    const invalidate = () => {
      for (const key of queryKeys) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "competition_matches",
        filter: `competition_id=eq.${competitionId}`,
      },
      invalidate,
    );

    if (opts?.includeCompetition) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "competitions",
          filter: `id=eq.${competitionId}`,
        },
        invalidate,
      );
    }

    if (opts?.includeEntries) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_entries",
          filter: `competition_id=eq.${competitionId}`,
        },
        invalidate,
      );
    }

    if (opts?.includePodium) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "podium_calls",
          filter: `competition_id=eq.${competitionId}`,
        },
        invalidate,
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    competitionId,
    qc,
    opts?.includeCompetition,
    opts?.includeEntries,
    opts?.includePodium,
    JSON.stringify(queryKeys),
  ]);
}

/** Single-match scoreboard: listen to that row + siblings on the same competition. */
export function useMatchRealtime(
  matchId: string | null | undefined,
  competitionId: string | null | undefined,
  queryKeys: QueryKey[],
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase.channel(`rt:match:${matchId}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "competition_matches",
        filter: `id=eq.${matchId}`,
      },
      () => {
        for (const key of queryKeys) {
          void qc.invalidateQueries({ queryKey: key });
        }
      },
    );

    if (competitionId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_matches",
          filter: `competition_id=eq.${competitionId}`,
        },
        () => {
          for (const key of queryKeys) {
            void qc.invalidateQueries({ queryKey: key });
          }
        },
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, competitionId, qc, JSON.stringify(queryKeys)]);
}
