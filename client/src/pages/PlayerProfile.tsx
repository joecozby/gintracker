import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Flame, Swords, Target, Trophy, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation, useParams } from "wouter";

export default function PlayerProfile() {
  const params = useParams<{ id: string }>();
  const playerId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.stats.playerProfile.useQuery({ playerId });
  const { data: h2hData } = trpc.stats.allHeadToHead.useQuery({ playerId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-muted-foreground">Player not found</div>;

  const { player, stats, eloHistory, winRate } = data;

  const eloChartData = eloHistory.map((e, i) => ({
    game: i + 1,
    elo: Math.round(e.newElo),
    delta: e.delta > 0 ? `+${e.delta.toFixed(1)}` : e.delta.toFixed(1),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/players")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-semibold">{player.name}</h1>
          {player.nickname && <p className="text-muted-foreground">"{player.nickname}"</p>}
        </div>
        <div className="ml-auto">
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{stats?.eloRating?.toFixed(0) ?? 1500}</p>
            <p className="text-xs text-muted-foreground">Elo Rating</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Trophy className="h-4 w-4 text-primary" />} label="Games Played" value={data.sessionsPlayed ?? 0} />
        <StatCard icon={<Target className="h-4 w-4 text-primary" />} label="Win Rate" value={`${winRate}%`} />
        <StatCard icon={<Flame className="h-4 w-4 text-primary" />} label="Best Streak" value={stats?.bestStreak ?? 0} />
        <StatCard icon={<Zap className="h-4 w-4 text-primary" />} label="Gin Count" value={stats?.ginCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Elo chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Elo Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eloChartData.length < 2 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Play more games to see your Elo trend
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={eloChartData}>
                  <defs>
                    <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.15 45)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.72 0.15 45)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 260)" />
                  <XAxis dataKey="game" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.16 0.01 260)", border: "1px solid oklch(0.25 0.01 260)", borderRadius: "8px" }}
                    labelStyle={{ color: "oklch(0.95 0.005 260)" }}
                    itemStyle={{ color: "oklch(0.72 0.15 45)" }}
                  />
                  <Area type="monotone" dataKey="elo" stroke="oklch(0.72 0.15 45)" fill="url(#eloGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Detailed stats */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatRow label="Games Won" value={data.sessionsWon ?? 0} total={data.sessionsPlayed ?? 0} />
            <StatRow label="Games Lost" value={(data.sessionsPlayed ?? 0) - (data.sessionsWon ?? 0)} total={data.sessionsPlayed ?? 0} color="destructive" />
            <StatRow label="Gin Hands" value={stats?.ginCount ?? 0} total={stats?.gamesPlayed ?? 0} />
            <StatRow label="Knock Hands" value={stats?.knockCount ?? 0} total={stats?.gamesPlayed ?? 0} />
            <StatRow label="Undercuts" value={stats?.undercutCount ?? 0} total={stats?.gamesPlayed ?? 0} />
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Streak</span>
                <span className={`font-medium ${(stats?.currentStreak ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {stats?.currentStreak ?? 0} {(stats?.currentStreak ?? 0) > 0 ? "🔥" : ""}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Avg Points/Game</span>
                <span className="font-medium text-foreground">
                  {stats && stats.gamesPlayed > 0 ? (stats.totalPoints / stats.gamesPlayed).toFixed(1) : "0"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Head-to-head */}
      {h2hData && h2hData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              Head-to-Head Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {h2hData.map((h) => (
                <div key={h.opponent?.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                  <span className="font-medium text-sm text-foreground flex-1">{h.opponent?.name}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-semibold">{h.wins}W</span>
                      <span className="text-muted-foreground">–</span>
                      <span className="text-muted-foreground">{h.losses}L</span>
                      <span className="text-xs text-muted-foreground">({h.gamesPlayed} games)</span>
                    </div>
                    <div className={`flex items-center gap-1 border-l border-border pl-3 font-bold text-sm ${
                      h.cumulativeGameScore > h.opponentCumulativeGameScore
                        ? "text-emerald-400"
                        : h.cumulativeGameScore < h.opponentCumulativeGameScore
                        ? "text-red-400"
                        : "text-muted-foreground"
                    }`}>
                      <span>{h.cumulativeGameScore}</span>
                      <span className="font-normal text-muted-foreground">–</span>
                      <span>{h.opponentCumulativeGameScore}</span>
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">pts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color === "destructive" ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
