/**
 * Elo Rating System for Gin Rummy
 *
 * Two algorithms are implemented:
 *
 * 1. Rank-Based (default): Each player is compared against every other player
 *    in the game using their rank. For each pair (i, j), if rank_i < rank_j,
 *    player i "beat" player j. The Elo update is the sum of all pairwise
 *    comparisons, normalized by (n-1) to prevent rating inflation.
 *
 * 2. Pairwise (alternate): Classic pairwise Elo where each player's result
 *    is compared against the field average expected score.
 *
 * K-factor strategy:
 *   - Novice players (< noviceThreshold games): higher K for faster convergence.
 *   - Established players: standard K.
 *   - Admin can tune K values via admin_settings table.
 */

export interface EloPlayerInput {
  playerId: number;
  rank: number; // 1 = best
  currentElo: number;
  gamesPlayed: number;
}

export interface EloUpdate {
  playerId: number;
  oldElo: number;
  newElo: number;
  delta: number;
}

export interface EloSettings {
  kFactorBase: number; // default 32
  kFactorNovice: number; // default 48
  noviceThreshold: number; // default 20 games
}

const DEFAULT_ELO_SETTINGS: EloSettings = {
  kFactorBase: 32,
  kFactorNovice: 48,
  noviceThreshold: 20,
};

function getKFactor(gamesPlayed: number, settings: EloSettings): number {
  return gamesPlayed < settings.noviceThreshold
    ? settings.kFactorNovice
    : settings.kFactorBase;
}

/**
 * Expected score for player A against player B using logistic function.
 */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Convert rank to a score in [0, 1] range.
 * Rank 1 (winner) = 1.0, last place = 0.0, ties interpolated.
 */
function rankToScore(rank: number, numPlayers: number): number {
  if (numPlayers === 1) return 1;
  return (numPlayers - rank) / (numPlayers - 1);
}

/**
 * Rank-Based Elo Update (recommended for multiplayer).
 *
 * For each player i, compare against every other player j:
 *   - Actual score S_ij = 1 if rank_i < rank_j, 0.5 if tie, 0 if rank_i > rank_j
 *   - Expected score E_ij = logistic(elo_i - elo_j)
 *   - Delta_i += K * (S_ij - E_ij)
 * Normalize by (n-1) to prevent inflation.
 */
export function computeRankBasedElo(
  players: EloPlayerInput[],
  settings: EloSettings = DEFAULT_ELO_SETTINGS
): EloUpdate[] {
  const n = players.length;
  if (n < 2) throw new Error("At least 2 players required for Elo computation");

  return players.map((player) => {
    const K = getKFactor(player.gamesPlayed, settings);
    let totalDelta = 0;

    for (const opponent of players) {
      if (opponent.playerId === player.playerId) continue;

      const E = expectedScore(player.currentElo, opponent.currentElo);
      let S: number;
      if (player.rank < opponent.rank) {
        S = 1; // player beat opponent
      } else if (player.rank === opponent.rank) {
        S = 0.5; // tie
      } else {
        S = 0; // player lost to opponent
      }

      totalDelta += K * (S - E);
    }

    // Normalize by (n-1) to keep rating changes proportional regardless of player count
    const delta = totalDelta / (n - 1);
    const newElo = Math.max(100, player.currentElo + delta); // floor at 100

    return {
      playerId: player.playerId,
      oldElo: player.currentElo,
      newElo: Math.round(newElo * 10) / 10,
      delta: Math.round(delta * 10) / 10,
    };
  });
}

/**
 * Pairwise Elo Update (alternate algorithm).
 *
 * Each player's result is compared against the field:
 *   - Actual score = rank-to-score conversion in [0,1]
 *   - Expected score = average expected score against all opponents
 *   - Delta = K * (actual - expected)
 */
export function computePairwiseElo(
  players: EloPlayerInput[],
  settings: EloSettings = DEFAULT_ELO_SETTINGS
): EloUpdate[] {
  const n = players.length;
  if (n < 2) throw new Error("At least 2 players required for Elo computation");

  return players.map((player) => {
    const K = getKFactor(player.gamesPlayed, settings);

    // Actual score based on rank
    const actualScore = rankToScore(player.rank, n);

    // Expected score: average of expected scores against each opponent
    const opponents = players.filter((p) => p.playerId !== player.playerId);
    const expectedAvg =
      opponents.reduce((sum, opp) => sum + expectedScore(player.currentElo, opp.currentElo), 0) /
      opponents.length;

    const delta = K * (actualScore - expectedAvg);
    const newElo = Math.max(100, player.currentElo + delta);

    return {
      playerId: player.playerId,
      oldElo: player.currentElo,
      newElo: Math.round(newElo * 10) / 10,
      delta: Math.round(delta * 10) / 10,
    };
  });
}

/**
 * Recompute all Elo ratings from scratch given an ordered list of games.
 * Returns a map of playerId -> final Elo rating.
 */
export function recomputeAllElo(
  games: Array<{
    gameId: number;
    results: Array<{ playerId: number; rank: number }>;
  }>,
  initialElo: number = 1500,
  algorithm: "rank_based" | "pairwise" = "rank_based",
  settings: EloSettings = DEFAULT_ELO_SETTINGS
): Map<number, number> {
  const eloMap = new Map<number, number>();
  const gamesPlayedMap = new Map<number, number>();

  const computeFn = algorithm === "rank_based" ? computeRankBasedElo : computePairwiseElo;

  for (const game of games) {
    const inputs: EloPlayerInput[] = game.results.map((r) => ({
      playerId: r.playerId,
      rank: r.rank,
      currentElo: eloMap.get(r.playerId) ?? initialElo,
      gamesPlayed: gamesPlayedMap.get(r.playerId) ?? 0,
    }));

    const updates = computeFn(inputs, settings);
    for (const update of updates) {
      eloMap.set(update.playerId, update.newElo);
      gamesPlayedMap.set(update.playerId, (gamesPlayedMap.get(update.playerId) ?? 0) + 1);
    }
  }

  return eloMap;
}
