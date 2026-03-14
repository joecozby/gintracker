/**
 * Gin Rummy Scoring Engine
 *
 * Standard rules:
 * - A player may knock when their unmatched deadwood ≤ 10 points.
 * - Gin: knocking with 0 deadwood (all cards in melds). Earns gin bonus + opponent's deadwood.
 * - Undercut: if the knocker's deadwood ≥ defender's deadwood after layoffs, the defender wins
 *   and earns the undercut bonus + the difference.
 * - Card values: A=1, 2-9=face value, 10/J/Q/K=10.
 */

export interface SessionSettings {
  targetScore: number;
  knockBonus: number;
  ginBonus: number;
  undercutBonus: number;
}

export interface PlayerHandInput {
  playerId: number;
  deadwoodPoints: number;
  isGin: boolean;
  isKnock: boolean; // true for the player who knocked/ginned
}

export interface HandResult {
  playerId: number;
  rank: number; // 1 = winner of this hand
  pointsScored: number; // points added to their running total (always positive)
  deadwoodPoints: number;
  isGin: boolean;
  isKnock: boolean;
  isUndercut: boolean;
}

/**
 * Compute the result of a single Gin Rummy hand.
 *
 * For a 2-player game:
 *   - The knocker wins if their deadwood < opponent's deadwood after layoffs.
 *   - If knocker's deadwood >= opponent's deadwood, it's an undercut (opponent wins).
 *   - Gin (0 deadwood) earns ginBonus + opponent's deadwood; no layoffs allowed.
 *
 * For multiplayer (3+ players):
 *   - The player with the lowest deadwood wins.
 *   - Ties in deadwood share rank 1 (both get 0 points; no points awarded for ties).
 *   - Each loser contributes their deadwood difference to the winner's score.
 *   - Gin bonus applied if the winner had 0 deadwood.
 *   - Undercut: if a non-knocker has deadwood ≤ knocker's deadwood, undercut applies.
 */
export function computeHandResults(
  players: PlayerHandInput[],
  settings: SessionSettings
): HandResult[] {
  if (players.length < 2) {
    throw new Error("At least 2 players required");
  }

  const knocker = players.find((p) => p.isKnock || p.isGin);
  if (!knocker) {
    throw new Error("One player must be marked as the knocker/gin player");
  }

  // Sort by deadwood ascending to determine ranks
  const sorted = [...players].sort((a, b) => a.deadwoodPoints - b.deadwoodPoints);
  const minDeadwood = sorted[0].deadwoodPoints;

  // Check for undercut: any non-knocker has deadwood ≤ knocker's deadwood
  const isUndercut =
    !knocker.isGin &&
    players.some((p) => p.playerId !== knocker.playerId && p.deadwoodPoints <= knocker.deadwoodPoints);

  // Determine winner
  let winnerId: number;
  if (isUndercut) {
    // The player with the lowest deadwood among non-knockers wins
    const nonKnockers = players.filter((p) => p.playerId !== knocker.playerId);
    const bestNonKnocker = nonKnockers.sort((a, b) => a.deadwoodPoints - b.deadwoodPoints)[0];
    winnerId = bestNonKnocker.playerId;
  } else {
    winnerId = knocker.playerId;
  }

  const winner = players.find((p) => p.playerId === winnerId)!;

  // Assign ranks
  const results: HandResult[] = players.map((p) => {
    const isWinner = p.playerId === winnerId;
    const isThisKnocker = p.playerId === knocker.playerId;
    const isThisUndercut = isUndercut && isThisKnocker;

    let pointsScored = 0;
    let rank = isWinner ? 1 : 2;

    if (isWinner) {
      // Base points = sum of (each loser's deadwood - winner's deadwood), floored at 0
      const basePoints = players
        .filter((op) => op.playerId !== winnerId)
        .reduce((sum, op) => sum + Math.max(0, op.deadwoodPoints - winner.deadwoodPoints), 0);

      // Apply bonuses
      let bonus = 0;
      if (winner.isGin) {
        bonus += settings.ginBonus;
        // For gin, winner gets ALL opponents' deadwood (no layoffs)
        const ginPoints = players
          .filter((op) => op.playerId !== winnerId)
          .reduce((sum, op) => sum + op.deadwoodPoints, 0);
        pointsScored = ginPoints + settings.ginBonus;
      } else if (isUndercut) {
        bonus += settings.undercutBonus;
        pointsScored = basePoints + bonus;
      } else {
        bonus += settings.knockBonus;
        pointsScored = basePoints + bonus;
      }
    }

    return {
      playerId: p.playerId,
      rank,
      pointsScored,
      deadwoodPoints: p.deadwoodPoints,
      isGin: p.isGin,
      isKnock: p.isKnock,
      // isUndercut is true for the WINNER (non-knocker) when an undercut occurred
      isUndercut: isUndercut && isWinner && !isThisKnocker,
    };
  });

  return results;
}

/**
 * Validate that a hand input is legal before computing results.
 */
export function validateHandInput(players: PlayerHandInput[]): string | null {
  if (players.length < 2) return "At least 2 players required";

  const knockers = players.filter((p) => p.isKnock || p.isGin);
  if (knockers.length === 0) return "One player must be the knocker or gin player";
  if (knockers.length > 1) return "Only one player can knock or gin per hand";

  const knocker = knockers[0];
  if (knocker.isGin && knocker.deadwoodPoints !== 0) {
    return "Gin requires 0 deadwood points";
  }
  if (knocker.isKnock && knocker.deadwoodPoints > 10) {
    return "Knock requires deadwood ≤ 10 points";
  }
  if (players.some((p) => p.deadwoodPoints < 0)) {
    return "Deadwood points cannot be negative";
  }

  return null;
}

/**
 * Check if a session is over (any player has reached or exceeded target score).
 */
export function checkSessionComplete(
  playerScores: { playerId: number; totalScore: number }[],
  targetScore: number
): number | null {
  const winner = playerScores.find((p) => p.totalScore >= targetScore);
  return winner ? winner.playerId : null;
}
