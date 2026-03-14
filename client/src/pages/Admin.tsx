import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { Download, RefreshCw, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: auditLog, isLoading: auditLoading } = trpc.admin.auditLog.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAdmin }
  );

  const recomputeMutation = trpc.admin.recomputeAll.useMutation({
    onSuccess: () => toast.success("Full recompute complete! All stats updated."),
    onError: (e) => toast.error(e.message),
  });

  const { data: exportJSON } = trpc.export.toJSON.useQuery(undefined, { enabled: false });

  const handleExportJSON = async () => {
    try {
      const data = await trpc.export.toJSON.useQuery().refetch();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gin-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Shield className="h-16 w-16 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-serif font-semibold text-foreground">Admin Access Required</h2>
        <p className="text-muted-foreground text-sm">You need administrator privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Admin</h1>
          <p className="text-muted-foreground mt-1">System management and data tools</p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <Shield className="h-3 w-3 mr-1" />
          Administrator
        </Badge>
      </div>

      <Tabs defaultValue="audit">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="audit" className="data-[state=active]:bg-card">Audit Log</TabsTrigger>
          <TabsTrigger value="tools" className="data-[state=active]:bg-card">Tools</TabsTrigger>
          <TabsTrigger value="export" className="data-[state=active]:bg-card">Export / Import</TabsTrigger>
        </TabsList>

        {/* Audit Log */}
        <TabsContent value="audit" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !auditLog || auditLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No audit events yet</div>
              ) : (
                <div className="space-y-2">
                  {auditLog.map((entry: any) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-border">
                            {entry.actionType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{entry.targetType}</span>
                          {entry.targetId && (
                            <span className="text-xs text-muted-foreground">#{entry.targetId}</span>
                          )}
                        </div>
                        {entry.afterJson && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{JSON.stringify(entry.afterJson).slice(0, 80)}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools */}
        <TabsContent value="tools" className="mt-4">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Recompute All Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Recalculates all Elo ratings, win rates, streaks, and head-to-head records from scratch
                  by replaying every non-reverted game in chronological order.
                  Use this if stats appear inconsistent after manual data changes.
                </p>
                <Button
                  onClick={() => {
                    if (confirm("Recompute all stats? This may take a moment.")) {
                      recomputeMutation.mutate();
                    }
                  }}
                  disabled={recomputeMutation.isPending}
                  variant="outline"
                  className="border-border hover:border-primary/50 hover:text-primary"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
                  {recomputeMutation.isPending ? "Recomputing..." : "Run Full Recompute"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  System Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your role</span>
                    <span className="text-foreground font-medium">{user?.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="text-foreground font-medium">{user?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Elo start rating</span>
                    <span className="text-foreground font-medium">1500</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">K-factor (low)</span>
                    <span className="text-foreground font-medium">40 (&lt;1400)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">K-factor (mid)</span>
                    <span className="text-foreground font-medium">20 (1400–1800)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">K-factor (high)</span>
                    <span className="text-foreground font-medium">10 (&gt;1800)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Export / Import */}
        <TabsContent value="export" className="mt-4">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Export Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Download all game data for backup or analysis. JSON includes full game history;
                  CSV formats are suitable for spreadsheet analysis.
                </p>
                <div className="flex flex-wrap gap-3">
                  <ExportButton type="json" label="Export JSON (full)" />
                  <ExportButton type="csv-games" label="Export Games CSV" />
                  <ExportButton type="csv-players" label="Export Players CSV" />
                  <ExportButton type="csv-leaderboard" label="Export Leaderboard CSV" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportButton({ type, label }: { type: string; label: string }) {
  const utils = trpc.useUtils();

  const handleClick = async () => {
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (type === "json") {
        const data = await utils.export.toJSON.fetch();
        content = JSON.stringify(data, null, 2);
        filename = `gin-tracker-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      } else if (type === "csv-games") {
        content = await utils.export.toCSV.fetch({ type: "games" });
        filename = `gin-games-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      } else if (type === "csv-players") {
        content = await utils.export.toCSV.fetch({ type: "players" });
        filename = `gin-players-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      } else {
        content = await utils.export.toCSV.fetch({ type: "leaderboard" });
        filename = `gin-leaderboard-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded!");
    } catch (e) {
      toast.error("Export failed");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="border-border hover:border-primary/50 hover:text-primary gap-2">
      <Download className="h-3 w-3" />
      {label}
    </Button>
  );
}
