import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { playersRouter } from "./routers/players";
import { sessionsRouter } from "./routers/sessions";
import { gamesRouter } from "./routers/games";
import { statsRouter, adminRouter } from "./routers/stats";
import { exportRouter, importRouter, aiRouter } from "./routers/exportImport";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  players: playersRouter,
  sessions: sessionsRouter,
  games: gamesRouter,
  stats: statsRouter,
  admin: adminRouter,
  export: exportRouter,
  import: importRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
