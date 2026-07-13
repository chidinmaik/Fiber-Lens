"use client";

import { useEffect, useState } from "react";
import { api, FailureAnalytics, RecentFailure, FailureCategoryStat, SeverityStat } from "@/lib/api-client";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  LiquidityFailure: "Liquidity", RoutingFailure: "Routing", Timeout: "Timeout",
  PeerOffline: "Peer Offline", FeeConstraint: "Fee", NetworkFailure: "Network",
  InvoiceError: "Invoice", OnionError: "Onion", UnknownFailure: "Unknown",
};

export default function DiagnosticsPage() {
  const [analytics, setAnalytics] = useState<FailureAnalytics | null>(null);
  const [recent, setRecent] = useState<RecentFailure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.analytics.failuresByCategory(), api.analytics.recentFailures(10)])
      .then(([a, r]) => { setAnalytics(a); setRecent(r); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading diagnostics...</p></div>;
  if (!analytics) return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Failed to load diagnostics.</p></div>;

  const total = analytics.totalDiagnostics || 1;

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-semibold tracking-tight">Diagnostics Center</h2><p className="text-muted-foreground mt-1">Failure patterns and operational visibility</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Failure Categories</h3>
          <div className="space-y-3">
            {analytics.categories.map((c: FailureCategoryStat) => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{CAT_LABELS[c.name] || c.name}</span><span className="font-mono">{c.count}</span></div>
                <div className="h-2 rounded-full bg-accent overflow-hidden"><div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${(c.count / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-card">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-info" />Severity Distribution</h3>
          <div className="space-y-3">
            {["Critical", "High", "Medium", "Low"].map((s) => (
              <div key={s} className="space-y-1">
                <div className="flex justify-between text-sm"><span className={`severity-${s.toLowerCase()}`}>{s}</span><span className="font-mono">{analytics.severity.find((x: SeverityStat) => x.name === s)?.count || 0}</span></div>
                <div className="h-2 rounded-full bg-accent overflow-hidden"><div className={`h-full rounded-full ${s === "Critical" || s === "High" ? "bg-destructive" : s === "Medium" ? "bg-warning" : "bg-success"}`} style={{ width: `${((analytics.severity.find((x: SeverityStat) => x.name === s)?.count || 0) / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-card">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" />Retryability</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(analytics.retryabilityBuckets).map(([b, c]: [string, number]) => (
              <div key={b} className="text-center p-4 rounded-lg bg-accent/30"><p className="text-2xl font-semibold">{c}</p><p className="text-xs text-muted-foreground mt-1">{b}%</p></div>
            ))}
          </div>
        </div>

        <div className="metric-card">
          <h3 className="text-sm font-medium mb-4">Recent Failure Reasons</h3>
          <div className="space-y-2">
            {recent.slice(0, 8).map((f) => (
              <div key={f.diagnosticId} className="text-sm border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between"><span className="font-medium text-xs">{CAT_LABELS[f.category] || f.category}</span><span className={`severity-${f.severity.toLowerCase()} text-xs`}>{f.severity}</span></div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.failedError || "No error details"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
