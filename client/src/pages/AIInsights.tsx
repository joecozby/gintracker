import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Brain, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function AIInsights() {
  const { data: players } = trpc.players.list.useQuery();
  const { data: sessions } = trpc.sessions.list.useQuery({ status: undefined });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [playerAnalysis, setPlayerAnalysis] = useState<string | null>(null);
  const [sessionAnalysis, setSessionAnalysis] = useState<string | null>(null);
  const [globalInsights, setGlobalInsights] = useState<string | null>(null);

  const analyzePlayerMutation = trpc.ai.analyzePlayer.useMutation({
    onSuccess: (data) => setPlayerAnalysis(typeof data.analysis === 'string' ? data.analysis : String(data.analysis)),
    onError: (e) => toast.error(e.message),
  });

  const analyzeSessionMutation = trpc.ai.analyzeSession.useMutation({
    onSuccess: (data) => setSessionAnalysis(typeof data.analysis === 'string' ? data.analysis : String(data.analysis)),
    onError: (e) => toast.error(e.message),
  });

  const getInsightsMutation = trpc.ai.getInsights.useMutation({
    onSuccess: (data) => setGlobalInsights(typeof data.analysis === 'string' ? data.analysis : String(data.analysis)),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold flex items-center gap-3">
            <Brain className="h-7 w-7 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered analysis of player performance, session patterns, and strategic recommendations
          </p>
        </div>
      </div>

      {/* Global insights */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Global Competitive Landscape
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Get an AI-generated overview of the current competitive state, dominant players, and emerging trends.
          </p>
          <Button
            onClick={() => getInsightsMutation.mutate()}
            disabled={getInsightsMutation.isPending}
            className="bg-primary text-primary-foreground hover:opacity-90 gap-2"
          >
            {getInsightsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {getInsightsMutation.isPending ? "Analyzing..." : "Generate Global Insights"}
          </Button>
          {globalInsights && (
            <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border prose-sm">
              <Streamdown>{globalInsights}</Streamdown>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player analysis */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Player Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Deep-dive analysis of a specific player's strengths, weaknesses, and strategic recommendations.
          </p>
          <div className="flex gap-3">
            <Select onValueChange={(v) => setSelectedPlayerId(parseInt(v))}>
              <SelectTrigger className="flex-1 bg-input border-border">
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {players?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selectedPlayerId && analyzePlayerMutation.mutate({ playerId: selectedPlayerId })}
              disabled={!selectedPlayerId || analyzePlayerMutation.isPending}
              className="bg-primary text-primary-foreground hover:opacity-90 gap-2 shrink-0"
            >
              {analyzePlayerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {analyzePlayerMutation.isPending ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
          {playerAnalysis && (
            <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="prose-sm text-foreground [&_strong]:text-primary [&_h1]:font-serif [&_h2]:font-serif [&_h3]:font-serif [&_ul]:text-muted-foreground [&_li]:text-muted-foreground">
                <Streamdown>{playerAnalysis}</Streamdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session analysis */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Session Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Analyze a specific game session for patterns, highlights, and strategic observations.
          </p>
          <div className="flex gap-3">
            <Select onValueChange={(v) => setSelectedSessionId(parseInt(v))}>
              <SelectTrigger className="flex-1 bg-input border-border">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {sessions?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selectedSessionId && analyzeSessionMutation.mutate({ sessionId: selectedSessionId })}
              disabled={!selectedSessionId || analyzeSessionMutation.isPending}
              className="bg-primary text-primary-foreground hover:opacity-90 gap-2 shrink-0"
            >
              {analyzeSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {analyzeSessionMutation.isPending ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
          {sessionAnalysis && (
            <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="prose-sm text-foreground [&_strong]:text-primary [&_h1]:font-serif [&_h2]:font-serif [&_h3]:font-serif">
                <Streamdown>{sessionAnalysis}</Streamdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
