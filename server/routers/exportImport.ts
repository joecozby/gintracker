import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addSessionPlayer,
  createGame,
  createGameResults,
  createPlayer,
  createSession,
  getAllGamesForRecompute,
  getGameResults,
  getLeaderboard,
  getPlayers,
  getSessions,
  getSessionPlayers,
  upsertPlayerStats,
} from "../db";
import { fullRecompute } from "../lib/gameProcessor";
import { invokeLLM } from "../_core/llm";
import { publicProcedure, router } from "../_core/trpc";

export const exportRouter = router({
  toJSON: publicProcedure.query(async () => {
    const [players, sessions, games] = await Promise.all([
      getPlayers(),
      getSessions(),
      getAllGamesForRecompute(),
    ]);

    const gamesWithResults = await Promise.all(
      games.map(async (g) => ({
        ...g,
        results: await getGameResults(g.id),
      }))
    );

    const sessionsWithPlayers = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        players: await getSessionPlayers(s.id),
      }))
    );

    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      players,
      sessions: sessionsWithPlayers,
      games: gamesWithResults,
    };
  }),

  toCSV: publicProcedure
    .input(z.object({ type: z.enum(["players", "games", "leaderboard"]) }))
    .query(async ({ input }) => {
      if (input.type === "players") {
        const players = await getPlayers();
        const headers = ["id", "name", "nickname", "notes", "isActive", "createdAt"];
        const rows = players.map((p) =>
          [p.id, p.name, p.nickname ?? "", p.notes ?? "", p.isActive, p.createdAt].join(",")
        );
        return [headers.join(","), ...rows].join("\n");
      }

      if (input.type === "games") {
        const games = await getAllGamesForRecompute();
        const headers = [
          "gameId",
          "sessionId",
          "handNumber",
          "playedAt",
          "playerId",
          "rank",
          "pointsScored",
          "deadwoodPoints",
          "isGin",
          "isKnock",
          "isUndercut",
        ];
        const rows: string[] = [];
        for (const game of games) {
          const results = await getGameResults(game.id);
          for (const r of results) {
            rows.push(
              [
                game.id,
                game.sessionId,
                game.handNumber,
                game.playedAt,
                r.playerId,
                r.rank,
                r.pointsScored,
                r.deadwoodPoints,
                r.isGin,
                r.isKnock,
                r.isUndercut,
              ].join(",")
            );
          }
        }
        return [headers.join(","), ...rows].join("\n");
      }

      if (input.type === "leaderboard") {
        const lb = await getLeaderboard(0);
        const headers = [
          "rank",
          "name",
          "eloRating",
          "gamesPlayed",
          "gamesWon",
          "winRate",
          "ginCount",
          "bestStreak",
        ];
        const rows = lb.map((r, i) =>
          [
            i + 1,
            r.playerName,
            r.eloRating,
            r.gamesPlayed,
            r.gamesWon,
            r.gamesPlayed > 0 ? ((r.gamesWon / r.gamesPlayed) * 100).toFixed(1) + "%" : "0%",
            r.ginCount,
            r.bestStreak,
          ].join(",")
        );
        return [headers.join(","), ...rows].join("\n");
      }

      return "";
    }),
});

export const importRouter = router({
  fromJSON: publicProcedure
    .input(
      z.object({
        data: z.object({
          players: z.array(
            z.object({
              name: z.string(),
              nickname: z.string().optional(),
              notes: z.string().optional(),
            })
          ),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const created: number[] = [];
      for (const p of input.data.players) {
        const id = await createPlayer({ ...p, createdByUserId: 0 });
        created.push(id);
      }
      return { playersCreated: created.length };
    }),
});

export const aiRouter = router({
  analyzePlayer: publicProcedure
    .input(z.object({ playerId: z.number() }))
    .mutation(async ({ input }) => {
      const { getPlayerById, getPlayerStats, getEloHistoryByPlayer } = await import("../db");
      const [player, stats, eloHistory] = await Promise.all([
        getPlayerById(input.playerId),
        getPlayerById(input.playerId).then(() => getPlayerStats(input.playerId)),
        getEloHistoryByPlayer(input.playerId, 20),
      ]);

      if (!player) throw new TRPCError({ code: "NOT_FOUND" });

      const prompt = `You are a Gin Rummy performance analyst. Analyze the following player data and provide:
1. A brief performance summary (2-3 sentences)
2. Key strengths (2-3 bullet points)
3. Areas for improvement (2-3 bullet points)
4. Strategic recommendations (2-3 bullet points)

Player: ${player.name}
Stats:
- Elo Rating: ${stats?.eloRating ?? 1500}
- Games Played: ${stats?.gamesPlayed ?? 0}
- Win Rate: ${stats && stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) : 0}%
- Gin Count: ${stats?.ginCount ?? 0}
- Knock Count: ${stats?.knockCount ?? 0}
- Undercut Count: ${stats?.undercutCount ?? 0}
- Best Streak: ${stats?.bestStreak ?? 0}
- Current Streak: ${stats?.currentStreak ?? 0}
- Avg Points/Game: ${stats && stats.gamesPlayed > 0 ? (stats.totalPoints / stats.gamesPlayed).toFixed(1) : 0}
- Recent Elo trend: ${eloHistory.length > 1 ? (eloHistory[eloHistory.length - 1].newElo - eloHistory[0].oldElo).toFixed(0) + " points over last ${eloHistory.length} games" : "insufficient data"}

Provide a concise, actionable analysis in markdown format.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert Gin Rummy coach and data analyst." },
          { role: "user", content: prompt },
        ],
      });

      return {
        analysis: response.choices[0]?.message?.content ?? "Unable to generate analysis.",
        playerName: player.name,
      };
    }),

  analyzeSession: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { getSessionById, getSessionPlayers, getGamesBySession, getGameResults, getPlayerById } =
        await import("../db");

      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const [sessionPlayersList, games] = await Promise.all([
        getSessionPlayers(input.sessionId),
        getGamesBySession(input.sessionId),
      ]);

      const playerDetails = await Promise.all(
        sessionPlayersList.map(async (sp) => {
          const player = await getPlayerById(sp.playerId);
          return { ...sp, name: player?.name ?? "Unknown" };
        })
      );

      const prompt = `Analyze this Gin Rummy session and provide insights:

Session: ${session.name}
Target Score: ${session.targetScore}
Hands Played: ${games.length}
Status: ${session.status}

Players:
${playerDetails.map((p) => `- ${p.name}: ${p.totalScore} pts, ${p.handsWon} wins`).join("\n")}

Provide:
1. Session summary
2. Standout moments or patterns
3. Player performance highlights
4. Strategic observations

Keep it concise and engaging.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert Gin Rummy analyst." },
          { role: "user", content: prompt },
        ],
      });

      return {
        analysis: response.choices[0]?.message?.content ?? "Unable to generate analysis.",
        sessionName: session.name,
      };
    }),

  getInsights: publicProcedure.mutation(async () => {
    const leaderboard = await getLeaderboard(1);
    if (leaderboard.length === 0) {
      return { analysis: "No game data available yet. Play some games to get insights!" };
    }

    const topPlayers = leaderboard.slice(0, 5);
    const prompt = `Analyze the overall Gin Rummy leaderboard and provide global insights:

Top Players:
${topPlayers
  .map(
    (p, i) =>
      `${i + 1}. ${p.playerName}: Elo ${p.eloRating?.toFixed(0)}, ${p.gamesPlayed} games, ${
        p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : 0
      }% win rate, ${p.ginCount} gins`
  )
  .join("\n")}

Total players: ${leaderboard.length}

Provide:
1. Overall competitive landscape (2-3 sentences)
2. Most dominant player analysis
3. Interesting patterns or rivalries
4. Predictions or trends

Keep it engaging and insightful.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert Gin Rummy analyst and commentator." },
        { role: "user", content: prompt },
      ],
    });

    return {
      analysis: response.choices[0]?.message?.content ?? "Unable to generate insights.",
    };
  }),
});
