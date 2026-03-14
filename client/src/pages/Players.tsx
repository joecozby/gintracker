import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Edit2, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Players() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: players, isLoading } = trpc.players.list.useQuery();
  const { data: leaderboard } = trpc.stats.leaderboard.useQuery({ minGames: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<{ id: number; name: string; nickname?: string; notes?: string } | null>(null);

  const createMutation = trpc.players.create.useMutation({
    onSuccess: () => {
      utils.players.list.invalidate();
      setCreateOpen(false);
      toast.success("Player created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.players.update.useMutation({
    onSuccess: () => {
      utils.players.list.invalidate();
      setEditPlayer(null);
      toast.success("Player updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.players.delete.useMutation({
    onSuccess: () => {
      utils.players.list.invalidate();
      toast.success("Player removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const getPlayerElo = (playerId: number) =>
    leaderboard?.find((l) => l.playerId === playerId)?.eloRating?.toFixed(0) ?? "1500";

  const getPlayerGames = (playerId: number) =>
    leaderboard?.find((l) => l.playerId === playerId)?.sessionsPlayed ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Players</h1>
          <p className="text-muted-foreground mt-1">Manage your roster of Gin Rummy players</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:opacity-90 gap-2">
              <Plus className="h-4 w-4" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-serif">Add New Player</DialogTitle>
            </DialogHeader>
            <PlayerForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : players?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <p className="text-4xl mb-4">♠</p>
            <p className="text-muted-foreground">No players yet. Add your first player to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players?.map((player) => {
            const rank = (leaderboard?.findIndex((l) => l.playerId === player.id) ?? -1) + 1;
            return (
              <Card
                key={player.id}
                className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => setLocation(`/players/${player.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 border border-border">
                      {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt={player.name} className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {player.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{player.name}</h3>
                        {rank > 0 && rank <= 3 && (
                          <span className={`text-sm ${rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600"}`}>
                            {rank === 1 ? "♛" : rank === 2 ? "♜" : "♝"}
                          </span>
                        )}
                      </div>
                      {player.nickname && (
                        <p className="text-xs text-muted-foreground">"{player.nickname}"</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">{getPlayerElo(player.id)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{getPlayerGames(player.id)} games</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditPlayer({ id: player.id, name: player.name, nickname: player.nickname ?? undefined, notes: player.notes ?? undefined })}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${player.name}?`)) deleteMutation.mutate({ id: player.id });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editPlayer} onOpenChange={(o) => !o && setEditPlayer(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Player</DialogTitle>
          </DialogHeader>
          {editPlayer && (
            <PlayerForm
              defaultValues={editPlayer}
              onSubmit={(data) => updateMutation.mutate({ id: editPlayer.id, ...data })}
              loading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayerForm({
  defaultValues,
  onSubmit,
  loading,
}: {
  defaultValues?: { name?: string; nickname?: string; notes?: string };
  onSubmit: (data: { name: string; nickname?: string; notes?: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [nickname, setNickname] = useState(defaultValues?.nickname ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="bg-input border-border"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Optional nickname"
          className="bg-input border-border"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          className="bg-input border-border resize-none"
          rows={3}
        />
      </div>
      <Button
        onClick={() => onSubmit({ name, nickname: nickname || undefined, notes: notes || undefined })}
        disabled={!name.trim() || loading}
        className="w-full bg-primary text-primary-foreground hover:opacity-90"
      >
        {loading ? "Saving..." : "Save Player"}
      </Button>
    </div>
  );
}
