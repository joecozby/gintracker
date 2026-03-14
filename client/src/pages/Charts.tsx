import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "oklch(0.72 0.15 45)",
  "oklch(0.65 0.18 200)",
  "oklch(0.60 0.20 150)",
  "oklch(0.68 0.18 300)",
  "oklch(0.62 0.20 30)",
  "oklch(0.70 0.16 100)",
];

const tooltipStyle = {
  contentStyle: {
    background: "oklch(0.16 0.01 260)",
    border: "1px solid oklch(0.25 0.01 260)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "oklch(0.95 0.005 260)" },
};

export default function Charts() {
  const { data: leaderboard, isLoading: lbLoading } = trpc.stats.leaderboard.useQuery({ minGames: 0 });
  const { data: players } = trpc.players.list.useQuery();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const { data: profile, isLoading: profileLoading } = trpc.stats.playerProfile.useQuery(
    { playerId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );

  // Win rate bar chart data
  const winRateData = leaderboard
    ?.filter((p) => p.gamesPlayed > 0)
    .map((p) => ({
      name: p.playerName.split(" ")[0],
      winRate: p.winRate,
      games: p.gamesPlayed,
    })) ?? [];

  // Gins vs Knocks pie data for selected player
  const ginKnockData = profile?.stats
    ? [
        { name: "Gin", value: profile.stats.ginCount },
        { name: "Knock", value: profile.stats.knockCount - profile.stats.ginCount },
        { name: "Other", value: Math.max(0, profile.stats.gamesWon - profile.stats.knockCount) },
      ].filter((d) => d.value > 0)
    : [];

  // Elo progression
  const eloData = profile?.eloHistory.map((e, i) => ({
    game: i + 1,
    elo: Math.round(e.newElo),
  })) ?? [];

  // Radar chart for top 5 players
  const radarData = leaderboard?.slice(0, 5).map((p) => ({
    name: p.playerName.split(" ")[0],
    Elo: Math.min(100, ((p.eloRating ?? 1500) - 1000) / 10),
    WinRate: p.winRate,
    Gins: Math.min(100, p.ginCount * 5),
    Streak: Math.min(100, (p.bestStreak ?? 0) * 10),
    Games: Math.min(100, p.gamesPlayed * 5),
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold">Charts & Analytics</h1>
        <p className="text-muted-foreground mt-1">Visual performance insights</p>
      </div>

      {/* Win Rate Bar Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Win Rate by Player</CardTitle>
        </CardHeader>
        <CardContent>
          {lbLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : winRateData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={winRateData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 260)" />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, "Win Rate"]} />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {winRateData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Elo Leaderboard Comparison */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Elo Ratings Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {lbLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={leaderboard?.slice(0, 10).map((p) => ({ name: p.playerName.split(" ")[0], elo: Math.round(p.eloRating ?? 1500) }))}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 260)" />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [v, "Elo"]} />
                <Bar dataKey="elo" radius={[4, 4, 0, 0]}>
                  {leaderboard?.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Player selector for individual charts */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Player analysis:</span>
        <Select onValueChange={(v) => setSelectedPlayerId(parseInt(v))}>
          <SelectTrigger className="w-48 bg-input border-border">
            <SelectValue placeholder="Select player" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {players?.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPlayerId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Elo progression */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Elo Progression</CardTitle>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : eloData.length < 2 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Need more games for trend data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={eloData}>
                    <defs>
                      <linearGradient id="eloGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.72 0.15 45)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.72 0.15 45)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 260)" />
                    <XAxis dataKey="game" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="elo" stroke="oklch(0.72 0.15 45)" fill="url(#eloGrad2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Win type breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Win Type Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : ginKnockData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No wins yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={ginKnockData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ginKnockData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend
                      formatter={(v) => <span style={{ color: "oklch(0.85 0.005 260)", fontSize: 12 }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Radar chart */}
      {radarData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Multi-Dimensional Comparison (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={[
                { metric: "Elo", ...Object.fromEntries(radarData.map((p) => [p.name, p.Elo])) },
                { metric: "Win%", ...Object.fromEntries(radarData.map((p) => [p.name, p.WinRate])) },
                { metric: "Gins", ...Object.fromEntries(radarData.map((p) => [p.name, p.Gins])) },
                { metric: "Streak", ...Object.fromEntries(radarData.map((p) => [p.name, p.Streak])) },
                { metric: "Games", ...Object.fromEntries(radarData.map((p) => [p.name, p.Games])) },
              ]}>
                <PolarGrid stroke="oklch(0.25 0.01 260)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} />
                {radarData.map((p, i) => (
                  <Radar
                    key={p.name}
                    name={p.name}
                    dataKey={p.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend formatter={(v) => <span style={{ color: "oklch(0.85 0.005 260)", fontSize: 12 }}>{v}</span>} />
                <Tooltip {...tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
