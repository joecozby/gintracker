import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addSessionPlayer,
  createSession,
  getGamesBySession,
  getGameResults,
  getPlayerById,
  getSessionById,
  getSessionPlayers,
  getSessions,
  updateSession,
  writeAuditLog,
} from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "completed", "cancelled"]).optional(),
      })
    )
    .query(async ({ input }) => {
      return getSessions(input.status);
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

  create: protectedProcedure
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
        createdByUserId: ctx.user.id,
      });

      // Add players to session
      for (const pid of playerIds) {
        await addSessionPlayer(sessionId, pid);
      }

      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "SESSION_CREATED",
        targetType: "session",
        targetId: sessionId,
        afterJson: { ...sessionData, playerIds },
      });

      return { id: sessionId };
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
      }
      await updateSession(input.id, { status: "completed", completedAt: new Date() });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "SESSION_COMPLETED",
        targetType: "session",
        targetId: input.id,
      });
      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      await updateSession(input.id, { status: "cancelled" });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "SESSION_CANCELLED",
        targetType: "session",
        targetId: input.id,
      });
      return { success: true };
    }),
});
