"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, AnalyticsOverview, RecentFailure } from "@/lib/api-client";
import { useWallet } from "@/hooks/useWallet";
import { CreditCard, CheckCircle2, XCircle, TrendingUp, Wallet, Radio } from "lucide-react";

export default function DashboardPage() {
  const { wallet } = useWallet();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [failures, setFailures] = useState<RecentFailure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.analytics.overview(),
      api.analytics.recentFailures(5),
    ])
      .then(([ov, fr]) => { setOverview(ov); setFailures(fr); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet.address]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading dashboard...</p></div>;
  }

  if (!overview) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Failed to load metrics.</p></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Payment observability overview for your Fiber node</p>
      </div>

      {/* Wallet Status Banner */}
      {wallet.connected ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <Wallet className="h-5 w-5 text-success" />
          <div className="flex-1">
            <p className="text-sm font-medium text-success">Wallet Connected — Filtering Your Payments</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{wallet.address}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success capitalize">{wallet.connector}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <Wallet className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning">No Wallet Connected</p>
            <p className="text-xs text-muted-foreground">Showing all payments. <Link href="/setup" className="text-info hover:underline">Connect a wallet</Link> to see your payments.</p>
          </div>
          <Link href="/setup" className="text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/70 transition-all">Setup →</Link>
        </div>
      )}

      {/* Data Source Indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className="h-3 w-3" />
        <span>
          {wallet.connected
            ? `Showing ${overview.totalPayments} payments for ${wallet.address?.slice(0, 12)}...`
            : `Showing ${overview.totalPayments} payments (all demo + Fiber data)`
          }
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-muted-foreground" /><span className="metric-label">Total Payments</span></div>
          <p className="metric-value mt-2">{overview.totalPayments}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-success" /><span className="metric-label">Successful</span></div>
          <p className="metric-value mt-2 text-success">{overview.successfulPayments}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3"><XCircle className="h-5 w-5 text-destructive" /><span className="metric-label">Failed</span></div>
          <p className="metric-value mt-2 text-destructive">{overview.failedPayments}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-info" /><span className="metric-label">Success Rate</span></div>
          <p className="metric-value mt-2 text-info">{overview.successRate}%</p>
        </div>
      </div>

      <div className="metric-card">
        <h3 className="text-sm font-medium mb-4">Recent Investigation Reports</h3>
        <div className="space-y-3">
          {failures.length > 0 ? failures.map((f) => (
            <Link key={f.diagnosticId} href={`/payments/${f.paymentHash}`}
              className="block rounded-md border border-border p-3 hover:bg-accent/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{f.paymentHash}</span>
                <span className="status-badge status-failed">Failed</span>
              </div>
              <p className="text-sm mt-1">{f.summary}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className={`severity-${f.severity.toLowerCase()}`}>{f.severity}</span>
                <span>Retryability: {f.retryability}%</span>
              </div>
            </Link>
          )) : <p className="text-sm text-muted-foreground">No failures recorded yet</p>}
        </div>
      </div>
    </div>
  );
}
