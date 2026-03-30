import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Swords, Trophy } from "lucide-react";
import { useState } from "react";

export default function HeadToHead() {
  const { data: players } = trpc.players.list.useQuery();
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);

  const { data: h2h, isLoading } = trpc.stats.headToHead.useQuery(
    { playerAId: playerAId!, playerBId: playerBId! },
    { enabled: !!playerAId && !!playerBId && playerAId !== playerBId }
  );

  const totalSessions = h2h?.sessionsPlayed ?? 0;
  const totalHands = h2h?.handsPlayed ?? 0;
  const winsA = h2h?.winsA ?? 0;
  const winsB = h2h?.winsB ?? 0;
  const pctA = totalSessions > 0 ? (winsA / totalSessions) * 100 : 50;
  const pctB = totalSessions > 0 ? (winsB / totalSessions) * 100 : 50;

  // Cumulative bonus-inclusive game scores
  const cumA = h2h?.cumulativeGameScoreA ?? 0;
  const cumB = h2h?.cumulativeGameScoreB ?? 0;

  // Raw hand points
  const rawA = h2h?.totalPointsA ?? 0;
  const rawB = h2h?.totalPointsB ?? 0;

  // Avg hand points per session (total hand points / sessions played)
  const avgHandPtsA = totalSessions > 0 ? (rawA / totalSessions).toFixed(1) : "—";
  const avgHandPtsB = totalSessions > 0 ? (rawB / totalSessions).toFixed(1) : "—";

  // Avg game score (bonus-inclusive) per session
  const avgGameScoreA = totalSessions > 0 ? (cumA / totalSessions).toFixed(1) : "—";
  const avgGameScoreB = totalSessions > 0 ? (cumB / totalSessions).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold">Head-to-Head</h1>
        <p className="text-muted-foreground mt-1">Compare performance between any two players</p>
      </div>

      {/* Player selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <Select onValueChange={(v) => setPlayerAId(parseInt(v))}>
          <SelectTrigger className="bg-input border-border">
            <SelectValue placeholder="Select Player A" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {players?.filter((p) => p.id !== playerBId).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Swords className="h-5 w-5 text-primary" />
            <span className="font-serif text-lg">vs</span>
          </div>
        </div>

        <Select onValueChange={(v) => setPlayerBId(parseInt(v))}>
          <SelectTrigger className="bg-input border-border">
            <SelectValue placeholder="Select Player B" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {players?.filter((p) => p.id !== playerAId).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {playerAId && playerBId && playerAId !== playerBId && (
        <>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !h2h || totalSessions === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No head-to-head games found between these players.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Main win/loss card */}
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Player A */}
                    <div className="text-center space-y-2">
                      <Avatar className="h-16 w-16 border-2 border-primary/30 mx-auto">
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                          {h2h.playerA?.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-foreground">{h2h.playerA?.name}</p>
                      <p className="text-4xl font-bold text-primary">{winsA}</p>
                      <p className="text-sm text-muted-foreground">wins</p>
                    </div>

                    {/* Center */}
                    <div className="text-center space-y-3">
                      <p className="text-muted-foreground text-sm">{totalSessions} {totalSessions === 1 ? "game" : "games"} played</p>
                      <div className="space-y-2">
                        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-primary rounded-l-full transition-all duration-500"
                            style={{ width: `${pctA}%` }}
                          />
                          <div
                            className="h-full bg-chart-2 rounded-r-full transition-all duration-500"
                            style={{ width: `${pctB}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{pctA.toFixed(0)}%</span>
                          <span>{pctB.toFixed(0)}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {winsA > winsB
                          ? `${h2h.playerA?.name} leads`
                          : winsB > winsA
                          ? `${h2h.playerB?.name} leads`
                          : "Tied"}
                      </p>
                    </div>

                    {/* Player B */}
                    <div className="text-center space-y-2">
                      <Avatar className="h-16 w-16 border-2 border-chart-2/30 mx-auto">
                        <AvatarFallback className="text-2xl bg-chart-2/10 text-chart-2 font-bold">
                          {h2h.playerB?.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-foreground">{h2h.playerB?.name}</p>
                      <p className="text-4xl font-bold text-chart-2">{winsB}</p>
                      <p className="text-sm text-muted-foreground">wins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cumulative game score — the headline rivalry stat */}
              <Card className="bg-card border-border border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Cumulative Game Score (all bonuses included)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-3xl font-bold text-primary">{cumA}</p>
                      <p className="text-xs text-muted-foreground">{h2h.playerA?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-chart-2">{cumB}</p>
                      <p className="text-xs text-muted-foreground">{h2h.playerB?.name}</p>
                    </div>
                  </div>
                  {/* Bar showing proportion */}
                  {(cumA + cumB) > 0 && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-primary rounded-l-full transition-all duration-500"
                        style={{ width: `${(cumA / (cumA + cumB)) * 100}%` }}
                      />
                      <div
                        className="h-full bg-chart-2 rounded-r-full transition-all duration-500"
                        style={{ width: `${(cumB / (cumA + cumB)) * 100}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detailed stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Raw hand points */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Hand Points Scored</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatRow
                      labelA={h2h.playerA?.name ?? ""}
                      valueA={rawA}
                      labelB={h2h.playerB?.name ?? ""}
                      valueB={rawB}
                    />
                  </CardContent>
                </Card>

                {/* Avg points per hand (raw) */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Hand Points per Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatRow
                      labelA={h2h.playerA?.name ?? ""}
                      valueA={avgHandPtsA}
                      labelB={h2h.playerB?.name ?? ""}
                      valueB={avgHandPtsB}
                    />
                  </CardContent>
                </Card>

                {/* Avg game score per session (bonus-inclusive) */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Game Score per Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatRow
                      labelA={h2h.playerA?.name ?? ""}
                      valueA={avgGameScoreA}
                      labelB={h2h.playerB?.name ?? ""}
                      valueB={avgGameScoreB}
                    />
                    <p className="text-xs text-muted-foreground mt-2">Includes all bonuses (game, line, shutout, differential)</p>
                  </CardContent>
                </Card>

                {/* Win rate */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatRow
                      labelA={h2h.playerA?.name ?? ""}
                      valueA={`${pctA.toFixed(0)}%`}
                      labelB={h2h.playerB?.name ?? ""}
                      valueB={`${pctB.toFixed(0)}%`}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Scoring key */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Scoring Key</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>Game bonus: +100 (winner)</span>
                    <span>Line bonus: +20 per hand won</span>
                    <span>Shutout bonus: +100 (winner)</span>
                    <span>Score diff bonus: winner − loser score</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {(!playerAId || !playerBId) && (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Select two players to compare their head-to-head record</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatRow({
  labelA,
  valueA,
  labelB,
  valueB,
}: {
  labelA: string;
  valueA: string | number;
  labelB: string;
  valueB: string | number;
}) {
  return (
    <div className="flex justify-between items-end">
      <div>
        <p className="text-2xl font-bold text-primary">{valueA}</p>
        <p className="text-xs text-muted-foreground">{labelA}</p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-chart-2">{valueB}</p>
        <p className="text-xs text-muted-foreground">{labelB}</p>
      </div>
    </div>
  );
}
