import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createGame,
  createGameResults,
  getGameById,
  getGameResults,
  getGamesBySession,
  getHeadToHead,
  getPlayerStats,
  getSessionById,
  getSessionPlayers,
  revertGame,
  updateSession,
  updateSessionPlayer,
  upsertHeadToHead,
  upsertPlayerStats,
  writeAuditLog,
} from "../db";
import { processGameLogged, processGameReverted } from "../lib/gameProcessor";
import { HandResult, computeHandResults, validateHandInput } from "../lib/scoring";
import { publicProcedure, router } from "../_core/trpc";

export const gamesRouter = router({
  getBySession: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input }) => {
      const games = await getGamesBySession(input.sessionId);
      const gamesWithResults = await Promise.all(
        games.map(async (g) => ({
          ...g,
          results: await getGameResults(g.id),
        }))
      );
      return gamesWithResults;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.id);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      const results = await getGameResults(input.id);
      return { ...game, results };
    }),

  logHand: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        dealerId: z.number().optional(),
        location: z.string().optional(),
        buyInAmount: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        players: z.array(
          z.object({
            playerId: z.number(),
            deadwoodPoints: z.number().min(0),
            isGin: z.boolean().default(false),
            isKnock: z.boolean().default(false),
          })
        ).min(2),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
      }

      // Validate hand input
      const validationError = validateHandInput(input.players);
      if (validationError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
      }

      // Compute hand results
      const handResults = computeHandResults(input.players, {
        targetScore: session.targetScore,
        knockBonus: session.knockBonus,
        ginBonus: session.ginBonus,
        undercutBonus: session.undercutBonus,
      });

      // Get current hand number
      const existingGames = await getGamesBySession(input.sessionId);
      const handNumber = existingGames.length + 1;

      // Create game record
      const gameId = await createGame({
        sessionId: input.sessionId,
        handNumber,
        dealerId: input.dealerId,
        location: input.location,
        buyInAmount: input.buyInAmount,
        notes: input.notes,
        tags: input.tags,
        createdByUserId: 0,
      });

      // Create game results
      await createGameResults(
        handResults.map((r) => ({
          gameId,
          playerId: r.playerId,
          rank: r.rank,
          pointsScored: r.pointsScored,
          deadwoodPoints: r.deadwoodPoints,
          isGin: r.isGin,
          isKnock: r.isKnock,
          isUndercut: r.isUndercut,
        }))
      );

      // Update session player running totals
      const sessionPlayersList = await getSessionPlayers(input.sessionId);
      for (const result of handResults) {
        const sp = sessionPlayersList.find((p) => p.playerId === result.playerId);
        if (sp) {
          await updateSessionPlayer(input.sessionId, result.playerId, {
            totalScore: sp.totalScore + result.pointsScored,
            handsWon: sp.handsWon + (result.rank === 1 ? 1 : 0),
            handsPlayed: sp.handsPlayed + 1,
          });
        }
      }

      // Process all side effects (Elo, stats, head-to-head)
      await processGameLogged({
        gameId,
        sessionId: input.sessionId,
        results: handResults,
        actorUserId: 0,
      });

      // Check if session is complete
      const updatedPlayers = await getSessionPlayers(input.sessionId);
      const sortedByScore = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const winner = sortedByScore[0];
      const sessionComplete = winner.totalScore >= session.targetScore;

      if (sessionComplete) {
        await updateSession(input.sessionId, { status: "completed", completedAt: new Date() });

        // Update sessionsPlayed and sessionsWon for all participants
        for (const sp of updatedPlayers) {
          const existing = await getPlayerStats(sp.playerId);
          const isWinner = sp.playerId === winner.playerId;
          await upsertPlayerStats(sp.playerId, {
            sessionsPlayed: (existing?.sessionsPlayed ?? 0) + 1,
            sessionsWon: (existing?.sessionsWon ?? 0) + (isWinner ? 1 : 0),
          });
        }

        // Compute full game scoring breakdown
        // Line bonus: 20 pts per hand won by each player
        // Game bonus: 100 pts to winner
        // Shutout bonus: 100 pts to winner if any opponent won zero hands
        // Score differential bonus: winner gets (winner score - loser score) as bonus
        const loser = sortedByScore[1];
        const loserHandsWon = loser?.handsWon ?? 0;
        const isShutout = loserHandsWon === 0;
        const scoreDifferential = (winner.totalScore ?? 0) - (loser?.totalScore ?? 0);
        const scoreDiffBonus = Math.max(0, scoreDifferential);

        const playerScoring = updatedPlayers.map((sp) => {
          const isWin = sp.playerId === winner.playerId;
          const lineBonus = sp.handsWon * 20;
          const gameBonus = isWin ? 100 : 0;
          const shutoutBonus = isWin && isShutout ? 100 : 0;
          const diffBonus = isWin ? scoreDiffBonus : 0;
          const totalGameScore = sp.totalScore + lineBonus + gameBonus + shutoutBonus + diffBonus;
          return {
            playerId: sp.playerId,
            sessionScore: sp.totalScore,
            handsWon: sp.handsWon,
            handsPlayed: sp.handsPlayed,
            lineBonus,
            gameBonus,
            shutoutBonus,
            diffBonus,
            totalGameScore,
          };
        });

        // Update head-to-head cumulative game scores + session wins (for 2-player sessions)
        if (updatedPlayers.length === 2) {
          const [pA, pB] = updatedPlayers;
          const scoringA = playerScoring.find((s) => s.playerId === pA.playerId);
          const scoringB = playerScoring.find((s) => s.playerId === pB.playerId);
          const existing = await getHeadToHead(pA.playerId, pB.playerId);
          const minId = Math.min(pA.playerId, pB.playerId);
          const isAMin = pA.playerId === minId;

          // Cumulative bonus-inclusive scores
          const existingCumA = isAMin ? (existing?.cumulativeGameScoreA ?? 0) : (existing?.cumulativeGameScoreB ?? 0);
          const existingCumB = isAMin ? (existing?.cumulativeGameScoreB ?? 0) : (existing?.cumulativeGameScoreA ?? 0);
          const newCumA = existingCumA + (scoringA?.totalGameScore ?? 0);
          const newCumB = existingCumB + (scoringB?.totalGameScore ?? 0);

          // Session-level win tracking
          const pAWonSession = winner.playerId === pA.playerId ? 1 : 0;
          const pBWonSession = winner.playerId === pB.playerId ? 1 : 0;
          const newSessWonA = (existing?.sessionsWonA ?? 0) + (isAMin ? pAWonSession : pBWonSession);
          const newSessWonB = (existing?.sessionsWonB ?? 0) + (isAMin ? pBWonSession : pAWonSession);

          await upsertHeadToHead(pA.playerId, pB.playerId, {
            cumulativeGameScoreA: isAMin ? newCumA : newCumB,
            cumulativeGameScoreB: isAMin ? newCumB : newCumA,
            sessionsPlayed: (existing?.sessionsPlayed ?? 0) + 1,
            sessionsWonA: newSessWonA,
            sessionsWonB: newSessWonB,
          });
        }

        return {
          gameId,
          handResults,
          sessionComplete: true,
          winnerId: winner.playerId,
          isShutout,
          playerScoring,
        };
      }

      return { gameId, handResults, sessionComplete: false, winnerId: null, isShutout: false, playerScoring: null };
    }),

  revert: publicProcedure
    .input(z.object({ gameId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.isReverted) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game already reverted" });
      }

      const results = await getGameResults(input.gameId);
      const handResults: HandResult[] = results.map((r) => ({
        playerId: r.playerId,
        rank: r.rank,
        pointsScored: r.pointsScored,
        deadwoodPoints: r.deadwoodPoints,
        isGin: r.isGin,
        isKnock: r.isKnock,
        isUndercut: r.isUndercut,
      }));

      // Mark game as reverted
      await revertGame(input.gameId, 0);

      // Reopen session if it was completed
      const session = await getSessionById(game.sessionId);
      if (session?.status === "completed") {
        await import("../db").then((m) =>
          m.updateSession(game.sessionId, { status: "active", completedAt: null as any })
        );
      }

      // Process undo (triggers full recompute)
      await processGameReverted(input.gameId, 0, handResults);

      return { success: true };
    }),
});
