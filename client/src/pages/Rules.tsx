import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Rules() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-serif font-semibold">Gin Rummy Rules</h1>
        <p className="text-muted-foreground mt-1">Complete reference for Gin Rummy gameplay and scoring</p>
      </div>

      <div className="space-y-4">
        <RuleSection title="Objective">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The goal of Gin Rummy is to be the first player to reach the target score (typically 100 points).
            Points are scored by forming <strong className="text-foreground">melds</strong> (sets of 3–4 cards of the same rank, or runs of 3+ consecutive cards of the same suit)
            and minimizing <strong className="text-foreground">deadwood</strong> (unmatched cards).
          </p>
        </RuleSection>

        <RuleSection title="Dealing">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Each player is dealt <strong className="text-foreground">10 cards</strong>. The remaining cards form the stock pile.
            The top card of the stock is turned face-up to start the discard pile.
            The non-dealer has the option to take the upcard first; if declined, the dealer may take it.
          </p>
        </RuleSection>

        <RuleSection title="Gameplay">
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            Players alternate turns. On each turn, a player must:
          </p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong className="text-foreground">Draw</strong> — take the top card from either the stock or discard pile</li>
            <li><strong className="text-foreground">Discard</strong> — place one card face-up on the discard pile</li>
          </ol>
        </RuleSection>

        <RuleSection title="Knocking">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A player may <strong className="text-foreground">knock</strong> when their deadwood count is 10 or fewer points.
            Face cards (J, Q, K) count as 10; Aces count as 1; numbered cards at face value.
            After knocking, both players lay down their melds. The opponent may <strong className="text-foreground">lay off</strong> their deadwood cards onto the knocker's melds.
          </p>
        </RuleSection>

        <RuleSection title="Gin">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A player achieves <strong className="text-foreground">Gin</strong> when all 10 cards form valid melds (0 deadwood).
            Going Gin earns a <strong className="text-foreground">Gin Bonus</strong> (default: 25 points) in addition to the opponent's deadwood count.
            The opponent cannot lay off cards when the winner has Gin.
          </p>
        </RuleSection>

        <RuleSection title="Scoring">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>The winner of each hand scores points based on the difference in deadwood:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ScoreCard title="Standard Knock" formula="Opponent deadwood − Knocker deadwood" />
              <ScoreCard title="Gin" formula="Opponent deadwood + Gin Bonus (25)" highlight />
              <ScoreCard title="Undercut" formula="Knocker deadwood − Opponent deadwood + Undercut Bonus (25)" note="When opponent has ≤ knocker's deadwood" />
              <ScoreCard title="Knock Bonus" formula="+ Knock Bonus (configurable)" note="Optional bonus for knocking" />
            </div>
          </div>
        </RuleSection>

        <RuleSection title="Undercut">
          <p className="text-sm text-muted-foreground leading-relaxed">
            An <strong className="text-foreground">undercut</strong> occurs when the non-knocking player has deadwood equal to or less than the knocker's deadwood.
            In this case, the non-knocker wins the hand and earns the <strong className="text-foreground">Undercut Bonus</strong> (default: 25 points)
            plus the difference in deadwood.
          </p>
        </RuleSection>

        <RuleSection title="Elo Rating System">
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            This tracker uses a <strong className="text-foreground">rank-based Elo system</strong> to measure player skill progression.
            Each player starts at <strong className="text-foreground">1500 Elo</strong>.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">K-Factor</strong> adjusts based on rating:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Below 1400 Elo: K = 40 (high volatility for new/developing players)</li>
              <li>1400–1800 Elo: K = 20 (standard)</li>
              <li>Above 1800 Elo: K = 10 (stable for elite players)</li>
            </ul>
            <p className="mt-2">
              After each game, Elo updates based on the expected vs actual outcome.
              Beating a higher-rated opponent yields more points; losing to a lower-rated opponent costs more.
            </p>
          </div>
        </RuleSection>

        <RuleSection title="Session Settings">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <SettingCard name="Target Score" default="100" desc="Points needed to win the session" />
            <SettingCard name="Gin Bonus" default="25" desc="Bonus for going Gin" />
            <SettingCard name="Undercut Bonus" default="25" desc="Bonus for undercutting" />
            <SettingCard name="Knock Bonus" default="0" desc="Optional bonus for knocking" />
          </div>
        </RuleSection>
      </div>
    </div>
  );
}

function RuleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ScoreCard({ title, formula, note, highlight }: { title: string; formula: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      <p className={`font-medium text-xs mb-1 ${highlight ? "text-primary" : "text-foreground"}`}>{title}</p>
      <p className="text-xs text-muted-foreground font-mono">{formula}</p>
      {note && <p className="text-xs text-muted-foreground/70 mt-1 italic">{note}</p>}
    </div>
  );
}

function SettingCard({ name, default: def, desc }: { name: string; default: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/30">
      <p className="font-medium text-xs text-foreground">{name}</p>
      <p className="text-lg font-bold text-primary">{def}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
