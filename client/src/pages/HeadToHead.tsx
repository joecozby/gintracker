import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Swords } from "lucide-react";
import { useState } from "react";

export default function HeadToHead() {
  const { data: players } = trpc.players.list.useQuery();
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);

  const { data: h2h, isLoading } = trpc.stats.headToHead.useQuery(
    { playerAId: playerAId!, playerBId: playerBId! },
    { enabled: !!playerAId && !!playerBId && playerAId !== playerBId }
  );

  const totalGames = h2h?.gamesPlayed ?? 0;
  const winsA = h2h?.winsA ?? 0;
  const winsB = h2h?.winsB ?? 0;
  const pctA = totalGames > 0 ? (winsA / totalGames) * 100 : 50;
  const pctB = totalGames > 0 ? (winsB / totalGames) * 100 : 50;

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
          ) : !h2h || totalGames === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No head-to-head games found between these players.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Main comparison card */}
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
                      <p className="text-muted-foreground text-sm">{totalGames} games played</p>
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

              {/* Points comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Points Scored</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-primary">{h2h.totalPointsA}</p>
                        <p className="text-xs text-muted-foreground">{h2h.playerA?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-chart-2">{h2h.totalPointsB}</p>
                        <p className="text-xs text-muted-foreground">{h2h.playerB?.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Points per Game</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {totalGames > 0 ? (h2h.totalPointsA / totalGames).toFixed(1) : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">{h2h.playerA?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-chart-2">
                          {totalGames > 0 ? (h2h.totalPointsB / totalGames).toFixed(1) : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">{h2h.playerB?.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
