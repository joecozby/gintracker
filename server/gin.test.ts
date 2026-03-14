import { describe, expect, it } from "vitest";
import { computeHandResults, validateHandInput } from "./lib/scoring";
import { computeRankBasedElo, computePairwiseElo } from "./lib/elo";

// ─── Scoring Tests ────────────────────────────────────────────────────────────

describe("validateHandInput", () => {
  it("rejects when no knocker", () => {
    const err = validateHandInput([
      { playerId: 1, deadwoodPoints: 5, isGin: false, isKnock: false },
      { playerId: 2, deadwoodPoints: 10, isGin: false, isKnock: false },
    ]);
    expect(err).toBeTruthy();
  });

  it("rejects when multiple knockers", () => {
    const err = validateHandInput([
      { playerId: 1, deadwoodPoints: 5, isGin: false, isKnock: true },
      { playerId: 2, deadwoodPoints: 10, isGin: false, isKnock: true },
    ]);
    expect(err).toBeTruthy();
  });

  it("accepts valid knock", () => {
    const err = validateHandInput([
      { playerId: 1, deadwoodPoints: 5, isGin: false, isKnock: true },
      { playerId: 2, deadwoodPoints: 10, isGin: false, isKnock: false },
    ]);
    expect(err).toBeNull();
  });

  it("accepts gin (isKnock + isGin on same player)", () => {
    const err = validateHandInput([
      { playerId: 1, deadwoodPoints: 0, isGin: true, isKnock: true },
      { playerId: 2, deadwoodPoints: 8, isGin: false, isKnock: false },
    ]);
    expect(err).toBeNull();
  });
});

describe("computeHandResults – standard knock", () => {
  const settings = { targetScore: 100, knockBonus: 0, ginBonus: 25, undercutBonus: 25 };

  it("knocker wins when they have less deadwood", () => {
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 5, isGin: false, isKnock: true },
        { playerId: 2, deadwoodPoints: 10, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.playerId).toBe(1);
    expect(winner.pointsScored).toBe(5); // 10 - 5
    expect(winner.isKnock).toBe(true);
    expect(winner.isGin).toBe(false);
    expect(winner.isUndercut).toBe(false);
  });

  it("undercut: opponent has equal deadwood → opponent wins + bonus", () => {
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 8, isGin: false, isKnock: true },
        { playerId: 2, deadwoodPoints: 8, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.playerId).toBe(2);
    expect(winner.isUndercut).toBe(true);
    expect(winner.pointsScored).toBe(25); // 0 diff + 25 undercut bonus
  });

  it("undercut: opponent has less deadwood → opponent wins + bonus", () => {
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 8, isGin: false, isKnock: true },
        { playerId: 2, deadwoodPoints: 3, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.playerId).toBe(2);
    expect(winner.isUndercut).toBe(true);
    expect(winner.pointsScored).toBe(30); // 5 diff + 25 undercut bonus
  });
});

describe("computeHandResults – gin", () => {
  const settings = { targetScore: 100, knockBonus: 0, ginBonus: 25, undercutBonus: 25 };

  it("gin: winner gets opponent deadwood + gin bonus", () => {
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 0, isGin: true, isKnock: true },
        { playerId: 2, deadwoodPoints: 12, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.playerId).toBe(1);
    expect(winner.isGin).toBe(true);
    expect(winner.pointsScored).toBe(37); // 12 + 25
  });

  it("gin with knock bonus: knock bonus not applied on gin", () => {
    const settingsWithKnock = { ...settings, knockBonus: 10 };
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 0, isGin: true, isKnock: true },
        { playerId: 2, deadwoodPoints: 15, isGin: false, isKnock: false },
      ],
      settingsWithKnock
    );
    const winner = results.find((r) => r.rank === 1)!;
    // Gin bonus only, no knock bonus
    expect(winner.pointsScored).toBe(40); // 15 + 25
  });
});

describe("computeHandResults – knock bonus", () => {
  it("knock bonus is added to knocker's points", () => {
    const settings = { targetScore: 100, knockBonus: 10, ginBonus: 25, undercutBonus: 25 };
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 3, isGin: false, isKnock: true },
        { playerId: 2, deadwoodPoints: 15, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.pointsScored).toBe(22); // 12 diff + 10 knock bonus
  });
});

describe("computeHandResults – 3 player", () => {
  const settings = { targetScore: 100, knockBonus: 0, ginBonus: 25, undercutBonus: 25 };

  it("handles 3 players with one knocker", () => {
    const results = computeHandResults(
      [
        { playerId: 1, deadwoodPoints: 4, isGin: false, isKnock: true },
        { playerId: 2, deadwoodPoints: 10, isGin: false, isKnock: false },
        { playerId: 3, deadwoodPoints: 7, isGin: false, isKnock: false },
      ],
      settings
    );
    const winner = results.find((r) => r.rank === 1)!;
    expect(winner.playerId).toBe(1);
    // Scores sum of all opponents' deadwood minus knocker's deadwood per opponent
    expect(winner.pointsScored).toBe(9); // (10-4) + (7-4) = 6 + 3 = 9
  });
});

// ─── Elo Tests ────────────────────────────────────────────────────────────────

describe("getKFactor (via computeRankBasedElo behavior)", () => {
  it("novice player (< 20 games) gets higher K-factor (larger delta)", () => {
    const novice = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 5 },
      { playerId: 2, rank: 2, currentElo: 1500, gamesPlayed: 5 },
    ]);
    const experienced = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 50 },
      { playerId: 2, rank: 2, currentElo: 1500, gamesPlayed: 50 },
    ]);
    expect(Math.abs(novice[0].delta)).toBeGreaterThan(Math.abs(experienced[0].delta));
  });
});

describe("computeRankBasedElo", () => {
  it("winner gains Elo, loser loses Elo", () => {
    const updates = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 50 },
      { playerId: 2, rank: 2, currentElo: 1500, gamesPlayed: 50 },
    ]);
    expect(updates[0].newElo).toBeGreaterThan(1500);
    expect(updates[1].newElo).toBeLessThan(1500);
  });

  it("delta is approximately symmetric for equal ratings", () => {
    const updates = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 50 },
      { playerId: 2, rank: 2, currentElo: 1500, gamesPlayed: 50 },
    ]);
    const deltaWin = updates[0].delta;
    const deltaLoss = updates[1].delta;
    expect(deltaWin + deltaLoss).toBeCloseTo(0, 0);
  });

  it("beating a stronger player yields more Elo", () => {
    const vsStrong = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 50 },
      { playerId: 2, rank: 2, currentElo: 2000, gamesPlayed: 50 },
    ]);
    const vsWeak = computeRankBasedElo([
      { playerId: 1, rank: 1, currentElo: 1500, gamesPlayed: 50 },
      { playerId: 2, rank: 2, currentElo: 1000, gamesPlayed: 50 },
    ]);
    expect(vsStrong[0].newElo).toBeGreaterThan(vsWeak[0].newElo);
  });
});

describe("rankBasedElo – 3 players", () => {
  const makePlayers = (elos: number[]) =>
    elos.map((elo, i) => ({ playerId: i + 1, rank: i + 1, currentElo: elo, gamesPlayed: 50 }));

  it("returns correct number of updates", () => {
    const updates = computeRankBasedElo(makePlayers([1500, 1500, 1500]));
    expect(updates).toHaveLength(3);
  });

  it("first place gains Elo, last place loses Elo", () => {
    const updates = computeRankBasedElo(makePlayers([1500, 1500, 1500]));
    expect(updates[0].newElo).toBeGreaterThan(1500);
    expect(updates[2].newElo).toBeLessThan(1500);
  });

  it("middle player has smaller absolute delta than extremes", () => {
    const updates = computeRankBasedElo(makePlayers([1500, 1500, 1500]));
    const deltaFirst = Math.abs(updates[0].delta);
    const deltaMiddle = Math.abs(updates[1].delta);
    const deltaLast = Math.abs(updates[2].delta);
    expect(deltaFirst).toBeGreaterThanOrEqual(deltaMiddle);
    expect(deltaLast).toBeGreaterThanOrEqual(deltaMiddle);
  });
});
