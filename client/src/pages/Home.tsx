import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { Activity, Gamepad2, Plus, Trophy, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: leaderboard, isLoading: lbLoading } = trpc.stats.leaderboard.useQuery({ minGames: 0 });
  const { data: sessions, isLoading: sessLoading } = trpc.sessions.list.useQuery({ status: undefined });
  const { data: players, isLoading: playersLoading } = trpc.players.list.useQuery();

  const activeSessions = sessions?.filter((s) => s.status === "active") ?? [];
  const recentSessions = sessions?.slice(0, 5) ?? [];
  const topPlayers = leaderboard?.slice(0, 3) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeSessions.length > 0
              ? `${activeSessions.length} active session${activeSessions.length > 1 ? "s" : ""} in progress`
              : "Ready to play some Gin?"}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/sessions")}
          className="bg-primary text-primary-foreground hover:opacity-90 gap-2"
        >
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Players"
          value={playersLoading ? null : (players?.length ?? 0)}
          sub="registered"
        />
        <StatCard
          icon={<Gamepad2 className="h-5 w-5 text-primary" />}
          label="Sessions"
          value={sessLoading ? null : (sessions?.length ?? 0)}
          sub="all time"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-primary" />}
          label="Active"
          value={sessLoading ? null : activeSessions.length}
          sub="in progress"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5 text-primary" />}
          label="Top Elo"
          value={lbLoading ? null : (leaderboard?.[0]?.eloRating?.toFixed(0) ?? "—")}
          sub={leaderboard?.[0]?.playerName ?? "no games yet"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Players */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Top Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lbLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topPlayers.length === 0 ? (
              <EmptyState message="No games played yet" action={() => setLocation("/players")} actionLabel="Add players" />
            ) : (
              <div className="space-y-2">
                {topPlayers.map((p, i) => (
                  <div
                    key={p.playerId}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/players/${p.playerId}`)}
                  >
                    <span className={`text-lg font-bold w-6 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-amber-600"}`}>
                      {i === 0 ? "♛" : i === 1 ? "♜" : "♝"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {p.playerName}
                        {p.playerNickname && (
                          <span className="text-muted-foreground font-normal ml-1">"{p.playerNickname}"</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.gamesPlayed} games · {p.winRate}% win rate</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{p.eloRating?.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Elo</p>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-1 text-muted-foreground hover:text-foreground" onClick={() => setLocation("/leaderboard")}>
                  View full leaderboard →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentSessions.length === 0 ? (
              <EmptyState message="No sessions yet" action={() => setLocation("/sessions")} actionLabel="Start a session" />
            ) : (
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/sessions/${s.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })} · target {s.targetScore}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "active" ? "default" : "secondary"}
                      className={s.status === "active" ? "bg-primary/20 text-primary border-primary/30" : ""}
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-1 text-muted-foreground hover:text-foreground" onClick={() => setLocation("/sessions")}>
                  View all sessions →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string | null; sub: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            {value === null ? (
              <Skeleton className="h-6 w-12 mt-1" />
            ) : (
              <p className="text-xl font-semibold text-foreground">{value}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, action, actionLabel }: { message: string; action: () => void; actionLabel: string }) {
  return (
    <div className="text-center py-8 space-y-3">
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={action}>{actionLabel}</Button>
    </div>
  );
}
