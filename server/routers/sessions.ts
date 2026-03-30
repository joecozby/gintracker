import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addSessionPlayer,
  createSession,
  deleteSession,
  getGamesBySession,
  getGameResults,
  getPlayerById,
  getSessionById,
  getSessionPlayers,
  getSessionPlayersWithNames,
  getSessions,
  updateSession,
  writeAuditLog,
} from "../db";
import { fullRecompute } from "../lib/gameProcessor";
import { publicProcedure, router } from "../_core/trpc";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "completed", "cancelled"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const sessionList = await getSessions(input.status);
      return Promise.all(
        sessionList.map(async (s) => {
          const players = await getSessionPlayersWithNames(s.id);
          const winner = s.status === "completed" ? players[0] ?? null : null;
          return { ...s, players, winnerId: winner?.playerId ?? null };
        })
      );
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const sessionPlayersList = await getSessionPlayers(input.id);
      const games = await getGamesBySession(input.id);

      // Enrich with game results
      const gamesWithResults = await Promise.all(
        games.map(async (g) => ({
          ...g,
          results: await getGameResults(g.id),
        }))
      );

      return { session, players: sessionPlayersList, games: gamesWithResults };
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        playerIds: z.array(z.number()).min(2),
        targetScore: z.number().min(10).max(1000).default(100),
        knockBonus: z.number().min(0).max(50).default(0),
        ginBonus: z.number().min(0).max(100).default(25),
        undercutBonus: z.number().min(0).max(100).default(25),
        buyInEnabled: z.boolean().default(false),
        buyInAmount: z.string().optional(),
        location: z.string().max(200).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { playerIds, ...sessionData } = input;

      // Validate all players exist
      for (const pid of playerIds) {
        const p = await getPlayerById(pid);
        if (!p) throw new TRPCError({ code: "NOT_FOUND", message: `Player ${pid} not found` });
      }

      const sessionId = await createSession({
        ...sessionData,
        createdByUserId: 0,
      });

      // Add players to session
      for (const pid of playerIds) {
        await addSessionPlayer(sessionId, pid);
      }

      await writeAuditLog({
        actorUserId: 0,
        actionType: "SESSION_CREATED",
        targetType: "session",
        targetId: sessionId,
        afterJson: { ...sessionData, playerIds },
      });

      return { id: sessionId };
    }),

  complete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
      }
      await updateSession(input.id, { status: "completed", completedAt: new Date() });
      await writeAuditLog({
        actorUserId: 0,
        actionType: "SESSION_COMPLETED",
        targetType: "session",
        targetId: input.id,
      });
      return { success: true };
    }),

  cancel: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      await updateSession(input.id, { status: "cancelled" });
      await writeAuditLog({
        actorUserId: 0,
        actionType: "SESSION_CANCELLED",
        targetType: "session",
        targetId: input.id,
      });
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const sessionName = session.name;
      await deleteSession(input.id);
      await writeAuditLog({
        actorUserId: 0,
        actionType: "SESSION_DELETED",
        targetType: "session",
        targetId: input.id,
        beforeJson: { name: sessionName },
      });
      // Recompute all derived stats so player_stats and head_to_head
      // reflect the deletion accurately
      await fullRecompute(0);
      return { success: true };
    }),
});
