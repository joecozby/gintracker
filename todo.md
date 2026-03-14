# Gin Tracker TODO

## Phase 1: Schema & Design System
- [x] Database schema: players, sessions, games, game_results, elo_history, head_to_head, audit_log
- [x] Run migrations via webdev_execute_sql
- [x] Design system: elegant dark theme, color palette, typography (Google Fonts)
- [x] Global CSS variables and Tailwind theme

## Phase 2: Core Backend Logic
- [x] Gin Rummy scoring engine (deadwood, knock, gin, undercut)
- [x] Rank-based Elo algorithm (multiplayer, K-factor strategy)
- [x] Pairwise Elo algorithm (alternate)
- [x] Head-to-head materialized table update logic
- [x] Audit log write helpers
- [x] Undo/recompute transactional job

## Phase 3: tRPC API Routes
- [x] Auth: me, logout
- [x] Players: list, create, update, delete, getById
- [x] Sessions: list, create, update, close, getById
- [x] Games: list, create, revert (undo), getById
- [x] Leaderboard: global rankings with filters
- [x] Stats: player stats, per-opponent breakdown
- [x] Head-to-head: pairwise comparison endpoint
- [x] Export: JSON and CSV export
- [x] Import: JSON/CSV import with validation
- [x] Admin: recompute Elo, recompute head-to-head, audit log viewer
- [x] AI Insights: LLM-powered performance analysis

## Phase 4: Frontend Core Pages
- [x] DashboardLayout with sidebar navigation
- [x] Home/Dashboard page with summary stats
- [x] Players roster page (list, create, edit, delete)
- [x] Player profile page with stats
- [x] Session list page
- [x] Game board page (active session scoreboard + log hand form)
- [x] New session modal

## Phase 5: Frontend Stats Pages
- [x] Leaderboard page with filters
- [x] Head-to-head comparison page
- [x] Charts page (Elo over time, win rates, score distribution)
- [x] Rules page (accordion sections)
- [x] Admin settings page (Elo recompute, audit log)
- [x] AI Insights page

## Phase 6: Seed Data & Tests
- [x] Unit tests: scoring engine (gin, undercut, deadwood tie, 3-player)
- [x] Unit tests: rank-based Elo update (novice K-factor, symmetry, upset bonus)
- [x] Unit tests: validateHandInput (all edge cases)
- [x] All 19 tests passing

## Phase 7: Polish & Delivery
- [x] Responsive mobile layout
- [x] Loading skeletons and empty states
- [x] Error handling and toast notifications
- [x] Final checkpoint
