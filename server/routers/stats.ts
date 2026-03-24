import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAdminSetting,
  getAllAdminSettings,
  getAuditLog,
  getEloHistoryByPlayer,
  getHeadToHead,
  getHeadToHeadForPlayer,
  getLeaderboard,
  getPlayerById,
  getPlayerStats,
  getPlayers,
  setAdminSetting,
  writeAuditLog,
} from "../db";
import { fullRecompute } from "../lib/gameProcessor";
import { publicProcedure, router } from "../_core/trpc";

export const statsRouter = router({
  leaderboard: publicProcedure
    .input(z.object({ minGames: z.number().min(0).default(0) }))
    .query(async ({ input }) => {
      const rows = await getLeaderboard(input.minGames);
      return rows.map((r, i) => ({
        rank: i + 1,
        playerId: r.playerId,
        playerName: r.playerName,
        playerNickname: r.playerNickname,
        playerAvatarUrl: r.playerAvatarUrl,
        eloRating: r.eloRating,
        handsPlayed: r.gamesPlayed,
        handsWon: r.gamesWon,
        handsLost: r.gamesLost,
        sessionsPlayed: r.sessionsPlayed,
        sessionsWon: r.sessionsWon,
        sessionsLost: (r.sessionsPlayed ?? 0) - (r.sessionsWon ?? 0),
        // winRate is session-level (games won, not hands won)
        winRate:
          (r.sessionsPlayed ?? 0) > 0 ? Math.round(((r.sessionsWon ?? 0) / r.sessionsPlayed) * 1000) / 10 : 0,
        handWinRate:
          r.gamesPlayed > 0 ? Math.round((r.gamesWon / r.gamesPlayed) * 1000) / 10 : 0,
        avgPoints:
          r.gamesPlayed > 0 ? Math.round((r.totalPoints / r.gamesPlayed) * 10) / 10 : 0,
        ginCount: r.ginCount,
        knockCount: r.knockCount,
        undercutCount: r.undercutCount,
        currentStreak: r.currentStreak,
        bestStreak: r.bestStreak,
        lastGameAt: r.lastGameAt,
      }));
    }),

  playerProfile: publicProcedure
    .input(z.object({ playerId: z.number() }))
    .query(async ({ input }) => {
      const [player, stats, eloHistory] = await Promise.all([
        getPlayerById(input.playerId),
        getPlayerStats(input.playerId),
        getEloHistoryByPlayer(input.playerId, 200),
      ]);
      if (!player) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        player,
        stats,
        eloHistory,
        sessionsPlayed: stats?.sessionsPlayed ?? 0,
        sessionsWon: stats?.sessionsWon ?? 0,
        handsPlayed: stats?.gamesPlayed ?? 0,
        handsWon: stats?.gamesWon ?? 0,
        // Session-level win rate
        winRate:
          stats && (stats.sessionsPlayed ?? 0) > 0
            ? Math.round(((stats.sessionsWon ?? 0) / stats.sessionsPlayed) * 1000) / 10
            : 0,
        // Hand-level win rate (for charts)
        handWinRate:
          stats && stats.gamesPlayed > 0
            ? Math.round((stats.gamesWon / stats.gamesPlayed) * 1000) / 10
            : 0,
      };
    }),

  headToHead: publicProcedure
    .input(z.object({ playerAId: z.number(), playerBId: z.number() }))
    .query(async ({ input }) => {
      const [playerA, playerB, h2h] = await Promise.all([
        getPlayerById(input.playerAId),
        getPlayerById(input.playerBId),
        getHeadToHead(input.playerAId, input.playerBId),
      ]);
      if (!playerA || !playerB) throw new TRPCError({ code: "NOT_FOUND" });

      // Normalize so playerA is always the requested playerAId
      const minId = Math.min(input.playerAId, input.playerBId);
      const isAFirst = input.playerAId === minId;

      return {
        playerA,
        playerB,
        gamesPlayed: h2h?.gamesPlayed ?? 0,
        winsA: isAFirst ? (h2h?.winsA ?? 0) : (h2h?.winsB ?? 0),
        winsB: isAFirst ? (h2h?.winsB ?? 0) : (h2h?.winsA ?? 0),
        totalPointsA: isAFirst ? (h2h?.totalPointsA ?? 0) : (h2h?.totalPointsB ?? 0),
        totalPointsB: isAFirst ? (h2h?.totalPointsB ?? 0) : (h2h?.totalPointsA ?? 0),
        cumulativeGameScoreA: isAFirst ? (h2h?.cumulativeGameScoreA ?? 0) : (h2h?.cumulativeGameScoreB ?? 0),
        cumulativeGameScoreB: isAFirst ? (h2h?.cumulativeGameScoreB ?? 0) : (h2h?.cumulativeGameScoreA ?? 0),
      };
    }),

  allHeadToHead: publicProcedure
    .input(z.object({ playerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getHeadToHeadForPlayer(input.playerId);

      // Fetch all opponent records in parallel instead of sequentially
      const opponentIds = rows.map((row) =>
        row.playerAId === input.playerId ? row.playerBId : row.playerAId
      );
      const opponents = await Promise.all(opponentIds.map((id) => getPlayerById(id)));

      return rows.map((row, i) => {
        const isAFirst = row.playerAId === input.playerId;
        return {
          opponent: opponents[i],
          gamesPlayed: row.gamesPlayed,
          wins: isAFirst ? row.winsA : row.winsB,
          losses: isAFirst ? row.winsB : row.winsA,
          totalPoints: isAFirst ? row.totalPointsA : row.totalPointsB,
          opponentPoints: isAFirst ? row.totalPointsB : row.totalPointsA,
          cumulativeGameScore: isAFirst ? (row.cumulativeGameScoreA ?? 0) : (row.cumulativeGameScoreB ?? 0),
          opponentCumulativeGameScore: isAFirst ? (row.cumulativeGameScoreB ?? 0) : (row.cumulativeGameScoreA ?? 0),
        };
      });
    }),
});

export const adminRouter = router({
  getSettings: publicProcedure.query(async () => {
    return getAllAdminSettings();
  }),

  updateSetting: publicProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await setAdminSetting(input.key, input.value);
      return { success: true };
    }),

  recomputeAll: publicProcedure.mutation(async () => {
    await fullRecompute(0);
    return { success: true };
  }),

  auditLog: publicProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return getAuditLog(input.limit, input.offset);
    }),
});
