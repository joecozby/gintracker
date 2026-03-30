import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { Calendar, Gamepad2, MapPin, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Sessions() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery({ status: undefined });
  const { data: players } = trpc.players.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // No auth layer — all actions are available to everyone
  const isAdmin = true;

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      utils.sessions.list.invalidate();
      setCreateOpen(false);
      toast.success("Session created!");
      setLocation(`/sessions/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      setDeleteConfirmOpen(false);
      setDeleteId(null);
      toast.success("Session deleted.");
    },
    onError: (e) => {
      toast.error(e.message);
      setDeleteConfirmOpen(false);
    },
  });

  const sessionToDelete = sessions?.find((s) => s.id === deleteId);
  const filtered = sessions?.filter((s) => filter === "all" || s.status === filter) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Sessions</h1>
          <p className="text-muted-foreground mt-1">Manage your Gin Rummy game sessions</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:opacity-90 gap-2">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Create New Session</DialogTitle>
            </DialogHeader>
            <CreateSessionForm
              players={players ?? []}
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "completed"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {sessions?.filter((s) => s.status === f).length ?? 0}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No sessions found. Start a new game!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => (
            <Card
              key={session.id}
              className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => setLocation(`/sessions/${session.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{session.name}</h3>
                      <Badge
                        variant={session.status === "active" ? "default" : "secondary"}
                        className={session.status === "active" ? "bg-primary/20 text-primary border-primary/30 text-xs" : "text-xs"}
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Target: {session.targetScore}
                      </span>
                      {session.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      {session.status === "completed" && session.players.length >= 2 && (() => {
                        const winner = session.players.find(p => p.playerId === session.winnerId);
                        const loser = session.players.find(p => p.playerId !== session.winnerId);
                        return (
                          <>
                            <p className="text-primary font-medium">{winner?.playerName} wins</p>
                            <p>{winner?.totalScore ?? 0} – {loser?.totalScore ?? 0}</p>
                          </>
                        );
                      })()}
                      {session.status === "active" && session.players.length >= 2 && (
                        <p>{session.players.map(p => p.playerName).join(" vs ")}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(session.id);
                          setDeleteConfirmOpen(true);
                        }}
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) setDeleteId(null);
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">Delete Session?</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {sessionToDelete?.name ?? "this session"}
              </span>{" "}
              and all of its hand history, scores, and Elo changes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteId(null);
              }}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId !== null) deleteMutation.mutate({ id: deleteId });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateSessionForm({
  players,
  onSubmit,
  loading,
}: {
  players: { id: number; name: string; nickname?: string | null }[];
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(`Game ${new Date().toLocaleDateString()}`);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [location, setLocation] = useState("");
  // Standard Gin Rummy rules — fixed values
  const targetScore = 100;
  const ginBonus = 25;
  const undercutBonus = 25;
  const knockBonus = 0;

  const togglePlayer = (id: number) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Session Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
      </div>

      <div className="space-y-2">
        <Label>Players (select 2+)</Label>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p.id)}
              className={`p-2 rounded-lg border text-sm text-left transition-all ${
                selectedPlayers.includes(p.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:border-primary/50"
              }`}
            >
              <span className="font-medium">{p.name}</span>
              {p.nickname && <span className="text-xs text-muted-foreground block">"{p.nickname}"</span>}
            </button>
          ))}
        </div>
        {players.length === 0 && (
          <p className="text-sm text-muted-foreground">No players yet. Add players first.</p>
        )}
      </div>

      {/* Fixed scoring rules — displayed as info, not editable */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Standard Rules</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Target score</span><span className="text-foreground font-medium">100</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Gin bonus</span><span className="text-foreground font-medium">+25</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Undercut bonus</span><span className="text-foreground font-medium">+25</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Knock bonus</span><span className="text-foreground font-medium">0</span></div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Location (optional)</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Living room" className="bg-input border-border" />
      </div>

      <Button
        onClick={() =>
          onSubmit({
            name,
            playerIds: selectedPlayers,
            targetScore,
            ginBonus,
            undercutBonus,
            knockBonus,
            location: location || undefined,
          })
        }
        disabled={!name.trim() || selectedPlayers.length < 2 || loading}
        className="w-full bg-primary text-primary-foreground hover:opacity-90"
      >
        {loading ? "Creating..." : `Start Session with ${selectedPlayers.length} players`}
      </Button>
    </div>
  );
}
