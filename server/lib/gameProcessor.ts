/**
 * Game Processor
 *
 * Handles all side-effects after a game is logged or reverted:
 *   1. Update session_players running totals
 *   2. Update player_stats (materialized aggregate)
 *   3. Compute and store Elo deltas (elo_history)
 *   4. Update head_to_head materialized table
 *   5. Write audit log entry
 *
 * Also provides the full recompute job for admin use.
 */

import {
  createEloHistory,
  deleteEloHistoryByGame,
  getAdminSetting,
  getAllCompletedSessionsWithPlayers,
  getAllGamesForRecompute,
  getGameResults,
  getHeadToHead,
  getPlayerStats,
  resetAllEloHistory,
  resetAllHeadToHead,
  resetAllPlayerStats,
  upsertHeadToHead,
  upsertPlayerStats,
  writeAuditLog,
} from "../db";
import { EloSettings, computePairwiseElo, computeRankBasedElo } from "./elo";
import { HandResult } from "./scoring";

export interface ProcessGameInput {
  gameId: number;
  sessionId: number;
  results: HandResult[];
  actorUserId: number;
}

async function getEloSettings(): Promise<EloSettings> {
  const [kBase, kNovice, threshold] = await Promise.all([
    getAdminSetting("elo_k_factor_base"),
    getAdminSetting("elo_k_factor_novice"),
    getAdminSetting("elo_novice_threshold"),
  ]);
  return {
    kFactorBase: kBase ? parseInt(kBase) : 32,
    kFactorNovice: kNovice ? parseInt(kNovice) : 48,
    noviceThreshold: threshold ? parseInt(threshold) : 20,
  };
}

/**
 * Process all side-effects after a new game hand is logged.
 */
export async function processGameLogged(input: ProcessGameInput): Promise<void> {
  const { gameId, results, actorUserId } = input;
  const settings = await getEloSettings();
  const algorithm = (await getAdminSetting("elo_algorithm")) ?? "rank_based";

  // 1. Update player_stats
  // NOTE: session_players totalScore/handsPlayed/handsWon are updated
  // directly in the logHand mutation in games.ts using the session-scoped
  // running total. Do NOT update them here to avoid overwriting with
  // global career points.
  for (const result of results) {
    const existing = await getPlayerStats(result.playerId);
    const isWin = result.rank === 1;
    const prevStreak = existing?.currentStreak ?? 0;
    const newStreak = isWin ? prevStreak + 1 : 0;
    const bestStreak = Math.max(existing?.bestStreak ?? 0, newStreak);

    await upsertPlayerStats(result.playerId, {
      gamesPlayed: (existing?.gamesPlayed ?? 0) + 1,
      gamesWon: (existing?.gamesWon ?? 0) + (isWin ? 1 : 0),
      gamesLost: (existing?.gamesLost ?? 0) + (isWin ? 0 : 1),
      totalPoints: (existing?.totalPoints ?? 0) + result.pointsScored,
      totalDeadwood: (existing?.totalDeadwood ?? 0) + result.deadwoodPoints,
      ginCount: (existing?.ginCount ?? 0) + (result.isGin ? 1 : 0),
      knockCount: (existing?.knockCount ?? 0) + (result.isKnock ? 1 : 0),
      undercutCount: (existing?.undercutCount ?? 0) + (result.isUndercut ? 1 : 0),
      currentStreak: newStreak,
      bestStreak,
      lastGameAt: new Date(),
    });
  }

  // 3. Compute Elo updates
  const eloInputs = await Promise.all(
    results.map(async (r) => {
      const stats = await getPlayerStats(r.playerId);
      return {
        playerId: r.playerId,
        rank: r.rank,
        currentElo: stats?.eloRating ?? 1500,
        gamesPlayed: (stats?.gamesPlayed ?? 1) - 1, // before this game
      };
    })
  );

  const computeFn = algorithm === "pairwise" ? computePairwiseElo : computeRankBasedElo;
  const eloUpdates = computeFn(eloInputs, settings);

  // Store elo history
  await createEloHistory(
    eloUpdates.map((u) => ({
      playerId: u.playerId,
      gameId,
      oldElo: u.oldElo,
      newElo: u.newElo,
      delta: u.delta,
      algorithm: algorithm as "rank_based" | "pairwise",
    }))
  );

  // Update player_stats with new Elo
  for (const update of eloUpdates) {
    await upsertPlayerStats(update.playerId, { eloRating: update.newElo });
  }

  // 4. Update head_to_head for all pairs
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i];
      const b = results[j];
      const minId = Math.min(a.playerId, b.playerId);
      const maxId = Math.max(a.playerId, b.playerId);
      const isAFirst = a.playerId === minId;

      const existing = await import("../db").then((m) =>
        m.getHeadToHead(minId, maxId)
      );

      const aWins = a.rank < b.rank ? 1 : 0;
      const bWins = b.rank < a.rank ? 1 : 0;

      await upsertHeadToHead(minId, maxId, {
        gamesPlayed: (existing?.gamesPlayed ?? 0) + 1,
        winsA: (existing?.winsA ?? 0) + (isAFirst ? aWins : bWins),
        winsB: (existing?.winsB ?? 0) + (isAFirst ? bWins : aWins),
        totalPointsA: (existing?.totalPointsA ?? 0) + (isAFirst ? a.pointsScored : b.pointsScored),
        totalPointsB: (existing?.totalPointsB ?? 0) + (isAFirst ? b.pointsScored : a.pointsScored),
      });
    }
  }

  // 5. Write audit log
  await writeAuditLog({
    actorUserId,
    actionType: "GAME_LOGGED",
    targetType: "game",
    targetId: gameId,
    afterJson: { results },
  });
}

/**
 * Process undo of a game: mark as reverted and trigger full recompute.
 */
export async function processGameReverted(
  gameId: number,
  actorUserId: number,
  beforeResults: HandResult[]
): Promise<void> {
  // Write audit log for the undo
  await writeAuditLog({
    actorUserId,
    actionType: "GAME_REVERTED",
    targetType: "game",
    targetId: gameId,
    beforeJson: { results: beforeResults },
  });

  // Trigger full recompute (idempotent)
  await fullRecompute(actorUserId);
}

/**
 * Full recompute of all derived data from authoritative game history.
 * Idempotent — safe to run multiple times.
 */
export async function fullRecompute(actorUserId: number): Promise<void> {
  // Reset all derived data
  await resetAllPlayerStats();
  await resetAllHeadToHead();
  await resetAllEloHistory();

  const settings = await getEloSettings();
  const algorithm = (await getAdminSetting("elo_algorithm")) ?? "rank_based";
  const computeFn = algorithm === "pairwise" ? computePairwiseElo : computeRankBasedElo;

  // Get all non-reverted games in chronological order
  const allGames = await getAllGamesForRecompute();

  // Track running state
  const eloMap = new Map<number, number>();
  const gamesPlayedMap = new Map<number, number>();
  const streakMap = new Map<number, number>();
  const bestStreakMap = new Map<number, number>();

  for (const game of allGames) {
    const results = await getGameResults(game.id);
    if (results.length === 0) continue;

    // Compute Elo
    const eloInputs = results.map((r) => ({
      playerId: r.playerId,
      rank: r.rank,
      currentElo: eloMap.get(r.playerId) ?? 1500,
      gamesPlayed: gamesPlayedMap.get(r.playerId) ?? 0,
    }));

    const eloUpdates = computeFn(eloInputs, settings);

    // Store elo history
    await createEloHistory(
      eloUpdates.map((u) => ({
        playerId: u.playerId,
        gameId: game.id,
        oldElo: u.oldElo,
        newElo: u.newElo,
        delta: u.delta,
        algorithm: algorithm as "rank_based" | "pairwise",
      }))
    );

    // Update running maps
    for (const update of eloUpdates) {
      eloMap.set(update.playerId, update.newElo);
    }

    // Update player stats
    for (const result of results) {
      const isWin = result.rank === 1;
      const gp = (gamesPlayedMap.get(result.playerId) ?? 0) + 1;
      gamesPlayedMap.set(result.playerId, gp);

      const prevStreak = streakMap.get(result.playerId) ?? 0;
      const newStreak = isWin ? prevStreak + 1 : 0;
      streakMap.set(result.playerId, newStreak);
      bestStreakMap.set(
        result.playerId,
        Math.max(bestStreakMap.get(result.playerId) ?? 0, newStreak)
      );

      const existing = await getPlayerStats(result.playerId);
      await upsertPlayerStats(result.playerId, {
        eloRating: eloMap.get(result.playerId) ?? 1500,
        gamesPlayed: gp,
        gamesWon: (existing?.gamesWon ?? 0) + (isWin ? 1 : 0),
        gamesLost: (existing?.gamesLost ?? 0) + (isWin ? 0 : 1),
        totalPoints: (existing?.totalPoints ?? 0) + result.pointsScored,
        totalDeadwood: (existing?.totalDeadwood ?? 0) + result.deadwoodPoints,
        ginCount: (existing?.ginCount ?? 0) + (result.isGin ? 1 : 0),
        knockCount: (existing?.knockCount ?? 0) + (result.isKnock ? 1 : 0),
        undercutCount: (existing?.undercutCount ?? 0) + (result.isUndercut ? 1 : 0),
        currentStreak: newStreak,
        bestStreak: bestStreakMap.get(result.playerId) ?? 0,
        lastGameAt: game.playedAt,
      });
    }

    // Update head-to-head for all pairs
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i];
        const b = results[j];
        const minId = Math.min(a.playerId, b.playerId);
        const maxId = Math.max(a.playerId, b.playerId);
        const isAFirst = a.playerId === minId;

        const existing = await import("../db").then((m) =>
          m.getHeadToHead(minId, maxId)
        );
        const aWins = a.rank < b.rank ? 1 : 0;
        const bWins = b.rank < a.rank ? 1 : 0;

        await upsertHeadToHead(minId, maxId, {
          gamesPlayed: (existing?.gamesPlayed ?? 0) + 1,
          winsA: (existing?.winsA ?? 0) + (isAFirst ? aWins : bWins),
          winsB: (existing?.winsB ?? 0) + (isAFirst ? bWins : aWins),
          totalPointsA:
            (existing?.totalPointsA ?? 0) + (isAFirst ? a.pointsScored : b.pointsScored),
          totalPointsB:
            (existing?.totalPointsB ?? 0) + (isAFirst ? b.pointsScored : a.pointsScored),
        });
      }
    }
  }

  // ── Session-level stats recompute ──────────────────────────────────────────
  // Replay sessionsPlayed/sessionsWon for player_stats and
  // sessionsPlayed/sessionsWonA/B + cumulativeGameScore for head_to_head
  const completedSessions = await getAllCompletedSessionsWithPlayers();

  for (const { session, players: sPlayers } of completedSessions) {
    if (sPlayers.length === 0) continue;
    const sorted = [...sPlayers].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
    const winner = sorted[0];

    // Update sessionsPlayed / sessionsWon for each player
    for (const sp of sPlayers) {
      const existing = await getPlayerStats(sp.playerId);
      await upsertPlayerStats(sp.playerId, {
        sessionsPlayed: (existing?.sessionsPlayed ?? 0) + 1,
        sessionsWon: (existing?.sessionsWon ?? 0) + (sp.playerId === winner.playerId ? 1 : 0),
      });
    }

    // Update head_to_head session stats for 2-player sessions
    if (sPlayers.length === 2) {
      const [pA, pB] = sPlayers;
      const minId = Math.min(pA.playerId, pB.playerId);
      const isAMin = pA.playerId === minId;
      const existing = await getHeadToHead(pA.playerId, pB.playerId);

      // Compute bonus-inclusive scores
      const loser = sorted[1];
      const loserHandsWon = loser?.handsWon ?? 0;
      const isShutout = loserHandsWon === 0;
      const scoreDiff = Math.max(0, (winner.totalScore ?? 0) - (loser?.totalScore ?? 0));

      const calcScore = (sp: typeof pA) => {
        const isWin = sp.playerId === winner.playerId;
        return (sp.totalScore ?? 0) +
          sp.handsWon * 20 +
          (isWin ? 100 : 0) +
          (isWin && isShutout ? 100 : 0) +
          (isWin ? scoreDiff : 0);
      };

      const scoreA = calcScore(pA);
      const scoreB = calcScore(pB);
      const pAWon = pA.playerId === winner.playerId ? 1 : 0;
      const pBWon = pB.playerId === winner.playerId ? 1 : 0;

      await upsertHeadToHead(pA.playerId, pB.playerId, {
        sessionsPlayed: (existing?.sessionsPlayed ?? 0) + 1,
        sessionsWonA: (existing?.sessionsWonA ?? 0) + (isAMin ? pAWon : pBWon),
        sessionsWonB: (existing?.sessionsWonB ?? 0) + (isAMin ? pBWon : pAWon),
        cumulativeGameScoreA: (existing?.cumulativeGameScoreA ?? 0) + (isAMin ? scoreA : scoreB),
        cumulativeGameScoreB: (existing?.cumulativeGameScoreB ?? 0) + (isAMin ? scoreB : scoreA),
      });
    }
  }

  await writeAuditLog({
    actorUserId,
    actionType: "FULL_RECOMPUTE",
    targetType: "system",
    targetId: 0,
    metadata: { gamesProcessed: allGames.length },
  });
}
