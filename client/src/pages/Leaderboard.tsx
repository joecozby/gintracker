import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Crown, Flame, Search, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Leaderboard() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [minGames, setMinGames] = useState(0);
  const { data: leaderboard, isLoading } = trpc.stats.leaderboard.useQuery({ minGames });

  const filtered = leaderboard?.filter((p) =>
    p.playerName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Leaderboard</h1>
          <p className="text-muted-foreground mt-1">Rankings by Elo rating</p>
        </div>
      </div>

      {/* Top 3 podium */}
      {!isLoading && filtered.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[filtered[1], filtered[0], filtered[2]].map((p, podiumIdx) => {
            const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
            const heights = ["h-28", "h-36", "h-24"];
            const icons = ["♜", "♛", "♝"];
            const colors = ["text-slate-300", "text-yellow-400", "text-amber-600"];
            if (!p) return <div key={podiumIdx} />;
            return (
              <div
                key={p.playerId}
                className="flex flex-col items-center gap-2 cursor-pointer group"
                onClick={() => setLocation(`/players/${p.playerId}`)}
              >
                <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary/50 transition-all">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {p.playerName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground text-center truncate max-w-full">{p.playerName}</p>
                <p className="text-xs text-primary font-semibold">{p.eloRating?.toFixed(0)} Elo</p>
                <div
                  className={`w-full ${heights[podiumIdx]} rounded-t-lg flex items-center justify-center ${
                    actualRank === 1 ? "bg-yellow-400/20 border border-yellow-400/30" :
                    actualRank === 2 ? "bg-slate-400/20 border border-slate-400/30" :
                    "bg-amber-600/20 border border-amber-600/30"
                  }`}
                >
                  <span className={`text-2xl ${colors[podiumIdx]}`}>{icons[podiumIdx]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="pl-9 bg-input border-border"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Min games:</span>
          {[0, 3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setMinGames(n)}
              className={`px-2 py-1 rounded text-xs transition-all ${minGames === n ? "bg-primary/20 text-primary" : "hover:bg-accent text-muted-foreground"}`}
            >
              {n === 0 ? "All" : n}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No players found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[3rem_1fr_repeat(5,_auto)] gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">Elo</span>
                <span className="text-right hidden sm:block">Games</span>
                <span className="text-right hidden sm:block">Win%</span>
                <span className="text-right hidden md:block">Gins</span>
                <span className="text-right hidden md:block">Streak</span>
              </div>
              {filtered.map((p) => (
                <div
                  key={p.playerId}
                  className="grid grid-cols-[3rem_1fr_repeat(5,_auto)] gap-2 px-4 py-3 items-center hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/players/${p.playerId}`)}
                >
                  <div className="flex items-center justify-center">
                    {p.rank <= 3 ? (
                      <span className={`text-lg ${p.rank === 1 ? "text-yellow-400" : p.rank === 2 ? "text-slate-300" : "text-amber-600"}`}>
                        {p.rank === 1 ? "♛" : p.rank === 2 ? "♜" : "♝"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{p.rank}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {p.playerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{p.playerName}</p>
                      {p.playerNickname && <p className="text-xs text-muted-foreground truncate">"{p.playerNickname}"</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-primary">{p.eloRating?.toFixed(0)}</span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-sm text-foreground">{p.gamesPlayed}</span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-sm text-foreground">{p.winRate}%</span>
                  </div>
                  <div className="text-right hidden md:block">
                    <span className="text-sm text-foreground">{p.ginCount}</span>
                  </div>
                  <div className="text-right hidden md:block">
                    <span className={`text-sm flex items-center justify-end gap-1 ${p.currentStreak > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {p.currentStreak > 0 && <Flame className="h-3 w-3" />}
                      {p.currentStreak}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
