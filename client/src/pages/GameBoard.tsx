import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle, Crown, Plus, RotateCcw, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function GameBoard() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [logOpen, setLogOpen] = useState(false);

  const { data, isLoading } = trpc.sessions.getById.useQuery({ id: sessionId });

  const revertMutation = trpc.games.revert.useMutation({
    onSuccess: () => {
      utils.sessions.getById.invalidate({ id: sessionId });
      toast.success("Hand reverted and stats recomputed");
    },
    onError: (e) => toast.error(e.message),
  });

  const completeMutation = trpc.sessions.complete.useMutation({
    onSuccess: () => {
      utils.sessions.getById.invalidate({ id: sessionId });
      toast.success("Session completed!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-muted-foreground">Session not found</div>;

  const { session, players, games } = data;

  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.totalScore - a.totalScore);
  const leader = sortedPlayers[0];
  const isActive = session.status === "active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/sessions")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-semibold">{session.name}</h1>
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={isActive ? "bg-primary/20 text-primary border-primary/30" : ""}
              >
                {session.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Target: {session.targetScore} pts · Hand {games.length} · Gin +{session.ginBonus} · Undercut +{session.undercutBonus}
            </p>
          </div>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:opacity-90 gap-2">
                  <Plus className="h-4 w-4" />
                  Log Hand
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif">Log Hand #{games.length + 1}</DialogTitle>
                </DialogHeader>
                <LogHandForm
                  sessionId={sessionId}
                  players={players}
                  onSuccess={() => {
                    utils.sessions.getById.invalidate({ id: sessionId });
                    setLogOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (confirm("Mark this session as complete?")) completeMutation.mutate({ id: sessionId });
              }}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete
            </Button>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedPlayers.map((sp, i) => {
          const isLeading = sp.playerId === leader?.playerId;
          const pct = session.targetScore > 0 ? Math.min(100, (sp.totalScore / session.targetScore) * 100) : 0;
          return (
            <Card
              key={sp.playerId}
              className={`bg-card border-border transition-all ${isLeading && isActive ? "border-primary/40 shadow-[0_0_20px_oklch(0.72_0.15_45/0.15)]" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1">
                      {isLeading && isActive && <Crown className="h-3 w-3 text-primary" />}
                      <p className="font-semibold text-sm text-foreground">
                        {players.find((p) => p.playerId === sp.playerId) ? sp.playerId : "?"}
                      </p>
                    </div>
                    <PlayerName playerId={sp.playerId} />
                  </div>
                  <span className={`text-xs font-medium ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">{sp.totalScore}</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{sp.handsWon}W / {sp.handsPlayed - sp.handsWon}L</span>
                  <span>{session.targetScore - sp.totalScore} to go</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hand history */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Hand History</CardTitle>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hands played yet. Log the first hand!
            </div>
          ) : (
            <div className="space-y-2">
              {[...games].reverse().map((game) => {
                const winner = game.results?.find((r: any) => r.rank === 1);
                const isGin = game.results?.some((r: any) => r.isGin);
                const isUndercut = game.results?.some((r: any) => r.isUndercut);
                return (
                  <div key={game.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">#{game.handNumber}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {game.results?.map((r: any) => (
                          <span key={r.playerId} className={`text-xs ${r.rank === 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            <PlayerNameInline playerId={r.playerId} />
                            {r.rank === 1 ? ` +${r.pointsScored}` : ` (${r.deadwoodPoints}dw)`}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {isGin && <Badge variant="outline" className="text-xs border-primary/30 text-primary px-1 py-0">Gin</Badge>}
                        {isUndercut && <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 px-1 py-0">Undercut</Badge>}
                      </div>
                    </div>
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => {
                          if (confirm("Revert this hand? Stats will be recomputed.")) {
                            revertMutation.mutate({ gameId: game.id });
                          }
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlayerName({ playerId }: { playerId: number }) {
  const { data } = trpc.players.getById.useQuery({ id: playerId });
  return <p className="text-xs text-muted-foreground truncate">{data?.name ?? "..."}</p>;
}

function PlayerNameInline({ playerId }: { playerId: number }) {
  const { data } = trpc.players.getById.useQuery({ id: playerId });
  return <span>{data?.name ?? "..."}</span>;
}

function LogHandForm({
  sessionId,
  players,
  onSuccess,
}: {
  sessionId: number;
  players: { playerId: number; totalScore: number }[];
  onSuccess: () => void;
}) {
  const [playerInputs, setPlayerInputs] = useState(
    players.map((p) => ({
      playerId: p.playerId,
      deadwoodPoints: 0,
      isGin: false,
      isKnock: false,
    }))
  );
  const [notes, setNotes] = useState("");

  const logMutation = trpc.games.logHand.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.sessionComplete
          ? "Session complete! 🎉"
          : `Hand logged! ${data.handResults.find((r) => r.rank === 1) ? "" : ""}`
      );
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const setKnocker = (playerId: number) => {
    setPlayerInputs((prev) =>
      prev.map((p) => ({
        ...p,
        isKnock: p.playerId === playerId,
        isGin: false,
      }))
    );
  };

  const setGinner = (playerId: number) => {
    setPlayerInputs((prev) =>
      prev.map((p) => ({
        ...p,
        isGin: p.playerId === playerId,
        isKnock: p.playerId === playerId,
        deadwoodPoints: p.playerId === playerId ? 0 : p.deadwoodPoints,
      }))
    );
  };

  const updateDeadwood = (playerId: number, value: number) => {
    setPlayerInputs((prev) =>
      prev.map((p) => (p.playerId === playerId ? { ...p, deadwoodPoints: value } : p))
    );
  };

  const knocker = playerInputs.find((p) => p.isKnock || p.isGin);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {playerInputs.map((pi) => (
          <PlayerHandInput
            key={pi.playerId}
            playerId={pi.playerId}
            deadwood={pi.deadwoodPoints}
            isKnocker={pi.isKnock && !pi.isGin}
            isGinner={pi.isGin}
            onSetKnocker={() => setKnocker(pi.playerId)}
            onSetGinner={() => setGinner(pi.playerId)}
            onDeadwoodChange={(v) => updateDeadwood(pi.playerId, v)}
          />
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hand notes..." className="bg-input border-border" />
      </div>

      <Button
        onClick={() => logMutation.mutate({ sessionId, players: playerInputs, notes: notes || undefined })}
        disabled={!knocker || logMutation.isPending}
        className="w-full bg-primary text-primary-foreground hover:opacity-90"
      >
        {logMutation.isPending ? "Logging..." : "Log Hand"}
      </Button>
    </div>
  );
}

function PlayerHandInput({
  playerId,
  deadwood,
  isKnocker,
  isGinner,
  onSetKnocker,
  onSetGinner,
  onDeadwoodChange,
}: {
  playerId: number;
  deadwood: number;
  isKnocker: boolean;
  isGinner: boolean;
  onSetKnocker: () => void;
  onSetGinner: () => void;
  onDeadwoodChange: (v: number) => void;
}) {
  const { data: player } = trpc.players.getById.useQuery({ id: playerId });

  return (
    <div className={`p-3 rounded-lg border transition-all ${isGinner ? "border-primary bg-primary/5" : isKnocker ? "border-primary/50 bg-primary/5" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-foreground">{player?.name ?? "..."}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSetKnocker}
            className={`text-xs px-2 py-1 rounded border transition-all ${isKnocker && !isGinner ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
          >
            Knock
          </button>
          <button
            type="button"
            onClick={onSetGinner}
            className={`text-xs px-2 py-1 rounded border transition-all ${isGinner ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
          >
            Gin ♠
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-20 shrink-0">Deadwood</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={isGinner ? 0 : deadwood}
          onChange={(e) => onDeadwoodChange(parseInt(e.target.value) || 0)}
          disabled={isGinner}
          className="bg-input border-border h-8 text-sm"
        />
      </div>
    </div>
  );
}
