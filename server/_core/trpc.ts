import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Kept as aliases of publicProcedure — app has no auth layer.
// Wire these to middleware if you add auth later.
export const protectedProcedure = t.procedure;
export const adminProcedure = t.procedure;
