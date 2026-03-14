import { boolean, decimal, float, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Players ──────────────────────────────────────────────────────────────────
export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nickname: varchar("nickname", { length: 50 }),
  avatarUrl: text("avatarUrl"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  targetScore: int("targetScore").default(100).notNull(),
  knockBonus: int("knockBonus").default(0).notNull(),
  ginBonus: int("ginBonus").default(25).notNull(),
  undercutBonus: int("undercutBonus").default(25).notNull(),
  buyInEnabled: boolean("buyInEnabled").default(false).notNull(),
  buyInAmount: decimal("buyInAmount", { precision: 10, scale: 2 }),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// ─── Session Players (join table) ─────────────────────────────────────────────
export const sessionPlayers = mysqlTable("session_players", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  playerId: int("playerId").notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  handsWon: int("handsWon").default(0).notNull(),
  handsPlayed: int("handsPlayed").default(0).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type SessionPlayer = typeof sessionPlayers.$inferSelect;
export type InsertSessionPlayer = typeof sessionPlayers.$inferInsert;

// ─── Games (individual hands) ─────────────────────────────────────────────────
export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  handNumber: int("handNumber").notNull(),
  dealerId: int("dealerId"),
  location: varchar("location", { length: 200 }),
  buyInAmount: decimal("buyInAmount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  isReverted: boolean("isReverted").default(false).notNull(),
  revertedAt: timestamp("revertedAt"),
  revertedByUserId: int("revertedByUserId"),
  createdByUserId: int("createdByUserId").notNull(),
  playedAt: timestamp("playedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;

// ─── Game Results (per-player outcome per hand) ───────────────────────────────
export const gameResults = mysqlTable("game_results", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  playerId: int("playerId").notNull(),
  rank: int("rank").notNull(), // 1 = winner
  pointsScored: int("pointsScored").notNull(), // points added to their total
  deadwoodPoints: int("deadwoodPoints").default(0).notNull(),
  isGin: boolean("isGin").default(false).notNull(),
  isKnock: boolean("isKnock").default(false).notNull(),
  isUndercut: boolean("isUndercut").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameResult = typeof gameResults.$inferSelect;
export type InsertGameResult = typeof gameResults.$inferInsert;

// ─── Elo History ──────────────────────────────────────────────────────────────
export const eloHistory = mysqlTable("elo_history", {
  id: int("id").autoincrement().primaryKey(),
  playerId: int("playerId").notNull(),
  gameId: int("gameId").notNull(),
  oldElo: float("oldElo").notNull(),
  newElo: float("newElo").notNull(),
  delta: float("delta").notNull(),
  algorithm: mysqlEnum("algorithm", ["rank_based", "pairwise"]).default("rank_based").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EloHistory = typeof eloHistory.$inferSelect;
export type InsertEloHistory = typeof eloHistory.$inferInsert;

// ─── Player Stats (materialized) ──────────────────────────────────────────────
export const playerStats = mysqlTable("player_stats", {
  id: int("id").autoincrement().primaryKey(),
  playerId: int("playerId").notNull().unique(),
  eloRating: float("eloRating").default(1500).notNull(),
  gamesPlayed: int("gamesPlayed").default(0).notNull(),  // hands played
  gamesWon: int("gamesWon").default(0).notNull(),        // hands won
  gamesLost: int("gamesLost").default(0).notNull(),      // hands lost
  sessionsPlayed: int("sessionsPlayed").default(0).notNull(), // full games (sessions) played
  sessionsWon: int("sessionsWon").default(0).notNull(),       // full games (sessions) won
  totalPoints: int("totalPoints").default(0).notNull(),
  totalDeadwood: int("totalDeadwood").default(0).notNull(),
  ginCount: int("ginCount").default(0).notNull(),
  knockCount: int("knockCount").default(0).notNull(),
  undercutCount: int("undercutCount").default(0).notNull(),
  currentStreak: int("currentStreak").default(0).notNull(),
  bestStreak: int("bestStreak").default(0).notNull(),
  lastGameAt: timestamp("lastGameAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlayerStats = typeof playerStats.$inferSelect;
export type InsertPlayerStats = typeof playerStats.$inferInsert;

// ─── Head-to-Head (materialized) ──────────────────────────────────────────────
export const headToHead = mysqlTable(
  "head_to_head",
  {
    id: int("id").autoincrement().primaryKey(),
    playerAId: int("playerAId").notNull(),
    playerBId: int("playerBId").notNull(),
    gamesPlayed: int("gamesPlayed").default(0).notNull(),
    winsA: int("winsA").default(0).notNull(),
    winsB: int("winsB").default(0).notNull(),
    totalPointsA: int("totalPointsA").default(0).notNull(),
    totalPointsB: int("totalPointsB").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [uniqueIndex("h2h_pair_idx").on(t.playerAId, t.playerBId)]
);

export type HeadToHead = typeof headToHead.$inferSelect;
export type InsertHeadToHead = typeof headToHead.$inferInsert;

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  actionType: varchar("actionType", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 100 }).notNull(),
  targetId: int("targetId").notNull(),
  beforeJson: json("beforeJson"),
  afterJson: json("afterJson"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ─── Admin Settings ───────────────────────────────────────────────────────────
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminSettings = typeof adminSettings.$inferSelect;
