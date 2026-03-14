import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  adminSettings,
  auditLog,
  eloHistory,
  gameResults,
  games,
  headToHead,
  playerStats,
  players,
  sessionPlayers,
  sessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Players ──────────────────────────────────────────────────────────────────
export async function getPlayers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(players).where(eq(players.isActive, true)).orderBy(asc(players.name));
}

export async function getPlayerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return result[0];
}

export async function createPlayer(data: {
  name: string;
  nickname?: string;
  avatarUrl?: string;
  notes?: string;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(players).values(data);
  return result[0].insertId;
}

export async function updatePlayer(
  id: number,
  data: { name?: string; nickname?: string; avatarUrl?: string; notes?: string; isActive?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(players).set(data).where(eq(players.id, id));
}

// ─── Player Stats ─────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.playerId, playerId))
    .limit(1);
  return result[0];
}

export async function getAllPlayerStats() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(playerStats).orderBy(desc(playerStats.eloRating));
}

export async function upsertPlayerStats(
  playerId: number,
  data: Partial<typeof playerStats.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(playerStats)
    .values({ playerId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export async function getSessions(status?: "active" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(sessions).orderBy(desc(sessions.createdAt));
  if (status) return q.where(eq(sessions.status, status));
  return q;
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result[0];
}

export async function createSession(data: typeof sessions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(sessions).values(data);
  return result[0].insertId;
}

export async function updateSession(
  id: number,
  data: Partial<typeof sessions.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(sessions).set(data).where(eq(sessions.id, id));
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Delete in dependency order: game_results → elo_history → games → session_players → sessions
  const sessionGames = await db.select({ id: games.id }).from(games).where(eq(games.sessionId, id));
  const gameIds = sessionGames.map((g) => g.id);
  if (gameIds.length > 0) {
    await db.delete(gameResults).where(inArray(gameResults.gameId, gameIds));
    await db.delete(eloHistory).where(inArray(eloHistory.gameId, gameIds));
    await db.delete(games).where(eq(games.sessionId, id));
  }
  await db.delete(sessionPlayers).where(eq(sessionPlayers.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}

// ─── Session Players ──────────────────────────────────────────────────────────
export async function getSessionPlayers(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sessionPlayers)
    .where(eq(sessionPlayers.sessionId, sessionId))
    .orderBy(desc(sessionPlayers.totalScore));
}

export async function addSessionPlayer(sessionId: number, playerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(sessionPlayers).values({ sessionId, playerId });
}

export async function updateSessionPlayer(
  sessionId: number,
  playerId: number,
  data: Partial<typeof sessionPlayers.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(sessionPlayers)
    .set(data)
    .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
}

// ─── Games ────────────────────────────────────────────────────────────────────
export async function getGamesBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(games)
    .where(and(eq(games.sessionId, sessionId), eq(games.isReverted, false)))
    .orderBy(asc(games.handNumber));
}

export async function getGameById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(games).where(eq(games.id, id)).limit(1);
  return result[0];
}

export async function createGame(data: typeof games.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(games).values(data);
  return result[0].insertId;
}

export async function revertGame(
  gameId: number,
  revertedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(games)
    .set({ isReverted: true, revertedAt: new Date(), revertedByUserId })
    .where(eq(games.id, gameId));
}

// ─── Game Results ─────────────────────────────────────────────────────────────
export async function getGameResults(gameId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameResults).where(eq(gameResults.gameId, gameId));
}

export async function createGameResults(results: typeof gameResults.$inferInsert[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (results.length === 0) return;
  await db.insert(gameResults).values(results);
}

export async function getGameResultsByPlayer(playerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gameResults)
    .innerJoin(games, eq(gameResults.gameId, games.id))
    .where(and(eq(gameResults.playerId, playerId), eq(games.isReverted, false)))
    .orderBy(desc(games.playedAt))
    .limit(limit);
}

// ─── Elo History ──────────────────────────────────────────────────────────────
export async function createEloHistory(entries: typeof eloHistory.$inferInsert[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (entries.length === 0) return;
  await db.insert(eloHistory).values(entries);
}

export async function getEloHistoryByPlayer(playerId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(eloHistory)
    .where(eq(eloHistory.playerId, playerId))
    .orderBy(asc(eloHistory.createdAt))
    .limit(limit);
}

export async function deleteEloHistoryByGame(gameId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(eloHistory).where(eq(eloHistory.gameId, gameId));
}

// ─── Head-to-Head ─────────────────────────────────────────────────────────────
export async function getHeadToHead(playerAId: number, playerBId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const minId = Math.min(playerAId, playerBId);
  const maxId = Math.max(playerAId, playerBId);
  const result = await db
    .select()
    .from(headToHead)
    .where(and(eq(headToHead.playerAId, minId), eq(headToHead.playerBId, maxId)))
    .limit(1);
  return result[0];
}

export async function upsertHeadToHead(
  playerAId: number,
  playerBId: number,
  data: Partial<typeof headToHead.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const minId = Math.min(playerAId, playerBId);
  const maxId = Math.max(playerAId, playerBId);
  await db
    .insert(headToHead)
    .values({ playerAId: minId, playerBId: maxId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

export async function getHeadToHeadForPlayer(playerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(headToHead)
    .where(or(eq(headToHead.playerAId, playerId), eq(headToHead.playerBId, playerId)));
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function writeAuditLog(entry: typeof auditLog.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(entry);
}

export async function getAuditLog(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── Admin Settings ───────────────────────────────────────────────────────────
export async function getAdminSetting(key: string): Promise<string | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, key))
    .limit(1);
  return result[0]?.value;
}

export async function setAdminSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(adminSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllAdminSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminSettings);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export async function getLeaderboard(minGames = 0) {
  const db = await getDb();
  if (!db) return [];
  const stats = await db
    .select({
      playerId: playerStats.playerId,
      eloRating: playerStats.eloRating,
      gamesPlayed: playerStats.gamesPlayed,
      gamesWon: playerStats.gamesWon,
      gamesLost: playerStats.gamesLost,
      sessionsPlayed: playerStats.sessionsPlayed,
      sessionsWon: playerStats.sessionsWon,
      totalPoints: playerStats.totalPoints,
      ginCount: playerStats.ginCount,
      knockCount: playerStats.knockCount,
      undercutCount: playerStats.undercutCount,
      currentStreak: playerStats.currentStreak,
      bestStreak: playerStats.bestStreak,
      lastGameAt: playerStats.lastGameAt,
      playerName: players.name,
      playerNickname: players.nickname,
      playerAvatarUrl: players.avatarUrl,
    })
    .from(playerStats)
    .innerJoin(players, eq(playerStats.playerId, players.id))
    .where(sql`${playerStats.gamesPlayed} >= ${minGames}`)
    .orderBy(desc(playerStats.eloRating));
  return stats;
}

// ─── Full Recompute ───────────────────────────────────────────────────────────
export async function getAllGamesForRecompute() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(games)
    .where(eq(games.isReverted, false))
    .orderBy(asc(games.playedAt));
}

export async function resetAllPlayerStats() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(playerStats).set({
    eloRating: 1500,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    totalPoints: 0,
    totalDeadwood: 0,
    ginCount: 0,
    knockCount: 0,
    undercutCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastGameAt: null,
  });
}

export async function resetAllHeadToHead() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(headToHead);
}

export async function resetAllEloHistory() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(eloHistory);
}
