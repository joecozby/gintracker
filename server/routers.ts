import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { playersRouter } from "./routers/players";
import { sessionsRouter } from "./routers/sessions";
import { gamesRouter } from "./routers/games";
import { statsRouter, adminRouter } from "./routers/stats";
import { exportRouter, importRouter, aiRouter } from "./routers/exportImport";

export const appRouter = router({
  system: systemRouter,
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
