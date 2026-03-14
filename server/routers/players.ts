import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createPlayer,
  getEloHistoryByPlayer,
  getHeadToHeadForPlayer,
  getLeaderboard,
  getPlayerById,
  getPlayerStats,
  getPlayers,
  updatePlayer,
  writeAuditLog,
} from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const playersRouter = router({
  list: publicProcedure.query(async () => {
    return getPlayers();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const player = await getPlayerById(input.id);
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      return player;
    }),

  getStats: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [player, stats, eloHistory, h2h] = await Promise.all([
        getPlayerById(input.id),
        getPlayerStats(input.id),
        getEloHistoryByPlayer(input.id, 100),
        getHeadToHeadForPlayer(input.id),
      ]);
      if (!player) throw new TRPCError({ code: "NOT_FOUND" });
      return { player, stats, eloHistory, h2h };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        nickname: z.string().max(50).optional(),
        avatarUrl: z.string().url().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createPlayer({ ...input, createdByUserId: ctx.user.id });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "PLAYER_CREATED",
        targetType: "player",
        targetId: id,
        afterJson: input,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        nickname: z.string().max(50).optional(),
        avatarUrl: z.string().url().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const before = await getPlayerById(id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      await updatePlayer(id, data);
      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "PLAYER_UPDATED",
        targetType: "player",
        targetId: id,
        beforeJson: before,
        afterJson: data,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const before = await getPlayerById(input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      await updatePlayer(input.id, { isActive: false });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        actionType: "PLAYER_DELETED",
        targetType: "player",
        targetId: input.id,
        beforeJson: before,
      });
      return { success: true };
    }),
});
