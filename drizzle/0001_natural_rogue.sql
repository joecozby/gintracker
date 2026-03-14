CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`actionType` varchar(100) NOT NULL,
	`targetType` varchar(100) NOT NULL,
	`targetId` int NOT NULL,
	`beforeJson` json,
	`afterJson` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elo_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`gameId` int NOT NULL,
	`oldElo` float NOT NULL,
	`newElo` float NOT NULL,
	`delta` float NOT NULL,
	`algorithm` enum('rank_based','pairwise') NOT NULL DEFAULT 'rank_based',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `elo_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`playerId` int NOT NULL,
	`rank` int NOT NULL,
	`pointsScored` int NOT NULL,
	`deadwoodPoints` int NOT NULL DEFAULT 0,
	`isGin` boolean NOT NULL DEFAULT false,
	`isKnock` boolean NOT NULL DEFAULT false,
	`isUndercut` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`handNumber` int NOT NULL,
	`dealerId` int,
	`location` varchar(200),
	`buyInAmount` decimal(10,2),
	`notes` text,
	`tags` json,
	`isReverted` boolean NOT NULL DEFAULT false,
	`revertedAt` timestamp,
	`revertedByUserId` int,
	`createdByUserId` int NOT NULL,
	`playedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `head_to_head` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerAId` int NOT NULL,
	`playerBId` int NOT NULL,
	`gamesPlayed` int NOT NULL DEFAULT 0,
	`winsA` int NOT NULL DEFAULT 0,
	`winsB` int NOT NULL DEFAULT 0,
	`totalPointsA` int NOT NULL DEFAULT 0,
	`totalPointsB` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `head_to_head_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`eloRating` float NOT NULL DEFAULT 1500,
	`gamesPlayed` int NOT NULL DEFAULT 0,
	`gamesWon` int NOT NULL DEFAULT 0,
	`gamesLost` int NOT NULL DEFAULT 0,
	`totalPoints` int NOT NULL DEFAULT 0,
	`totalDeadwood` int NOT NULL DEFAULT 0,
	`ginCount` int NOT NULL DEFAULT 0,
	`knockCount` int NOT NULL DEFAULT 0,
	`undercutCount` int NOT NULL DEFAULT 0,
	`currentStreak` int NOT NULL DEFAULT 0,
	`bestStreak` int NOT NULL DEFAULT 0,
	`lastGameAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_stats_playerId_unique` UNIQUE(`playerId`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nickname` varchar(50),
	`avatarUrl` text,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`playerId` int NOT NULL,
	`totalScore` int NOT NULL DEFAULT 0,
	`handsWon` int NOT NULL DEFAULT 0,
	`handsPlayed` int NOT NULL DEFAULT 0,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`targetScore` int NOT NULL DEFAULT 100,
	`knockBonus` int NOT NULL DEFAULT 0,
	`ginBonus` int NOT NULL DEFAULT 25,
	`undercutBonus` int NOT NULL DEFAULT 25,
	`buyInEnabled` boolean NOT NULL DEFAULT false,
	`buyInAmount` decimal(10,2),
	`location` varchar(200),
	`notes` text,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
