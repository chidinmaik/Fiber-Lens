"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, InvestigationReport, RouteAttempt, RouteNode, TimelineEvent } from "@/lib/api-client";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Route, Radio, Shield, Zap } from "lucide-react";

export default function InvestigationReportPage() {
  const { hash } = useParams<{ hash: string }>();
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.payments.get(hash as string).then(setReport).catch(console.error).finally(() => setLoading(false));
  }, [hash]);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading investigation report...</p></div>;
  if (!report) return <div className="flex flex-col items-center justify-center h-full gap-4"><AlertTriangle className="h-12 w-12 text-destructive" /><p className="text-muted-foreground">Payment not found</p><Link href="/payments" className="text-info hover:underline">← Back to payments</Link></div>;

  const { payment, diagnostic, routeAttempts, timeline, rawFiberData } = report;
  const sevColor = (s: string) => ({ Low: "severity-low", Medium: "severity-medium", High: "severity-high", Critical: "severity-critical" }[s] || "severity-medium");
  const badge = (s: string) => `status-badge ${({ Success: "status-success", Failed: "status-failed", Inflight: "status-inflight" }[s] || "status-created")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/payments" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div><h2 className="text-2xl font-semibold tracking-tight">Investigation Report</h2><p className="text-sm font-mono text-muted-foreground mt-1">{payment.paymentHash}</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card"><span className={badge(payment.status)}>{payment.status}</span><p className="text-xs text-muted-foreground mt-2">Status</p></div>
        <div className="metric-card"><p className={`text-lg font-semibold ${sevColor(diagnostic.severity)}`}>{diagnostic.category.replace(/([A-Z])/g, " $1").trim()}</p><p className="text-xs text-muted-foreground mt-2">Category</p></div>
        <div className="metric-card"><p className={`text-lg font-semibold ${sevColor(diagnostic.severity)}`}>{diagnostic.severity}</p><p className="text-xs text-muted-foreground mt-2">Severity</p></div>
        <div className="metric-card"><p className="text-lg font-semibold">{diagnostic.retryability}%</p><p className="text-xs text-muted-foreground mt-2">Retryability</p></div>
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-warning" /><h3 className="text-sm font-medium">Summary</h3></div>
        <p className="text-sm">{diagnostic.summary}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground"><span>Confidence: {diagnostic.confidence}%</span><span>Fiber Error: {payment.failedError || "N/A"}</span></div>
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-2 mb-4"><Route className="h-4 w-4 text-info" /><h3 className="text-sm font-medium">Route Analysis</h3></div>
        {routeAttempts.length > 0 ? routeAttempts.map((a: RouteAttempt, ai: number) => (
          <div key={ai} className="border border-border rounded-lg p-4 mb-4 last:mb-0">
            <div className="flex items-center justify-between mb-3"><span className="text-sm font-medium">Attempt {a.attemptIndex + 1}</span><span className={badge(a.status)}>{a.status}</span></div>
            <div className="flex flex-wrap items-center gap-2">
              {a.routeNodes.map((n: RouteNode, ni: number) => (
                <div key={ni} className="flex items-center gap-2">
                  <div className={`hop-node ${a.failingHop === ni + 1 ? "hop-failed" : a.status === "Success" ? "hop-success" : ""}`}><Radio className="h-3 w-3" /><span className="text-xs truncate max-w-[100px]">{n.pubkey.slice(0, 8)}...</span></div>
                  {ni < a.routeNodes.length - 1 && <div className="hop-arrow"><span className="text-xs mx-1">→</span></div>}
                </div>
              ))}
            </div>
            {a.failureReason && <p className="text-xs text-destructive mt-3">Failed: {a.failureReason}</p>}
          </div>
        )) : <p className="text-sm text-muted-foreground">No route data available</p>}
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-2 mb-4"><Clock className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-medium">Timeline</h3></div>
        <div className="space-y-0">
          {timeline.map((e: TimelineEvent, i: number) => (
            <div key={i} className="flex gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={`h-2 w-2 rounded-full mt-1.5 ${e.event.includes("Failed") ? "bg-destructive" : e.event.includes("Success") ? "bg-success" : "bg-muted-foreground"}`} />
                {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1"><p className="text-sm font-medium">{e.event}</p><p className="text-xs text-muted-foreground">{e.description}</p><p className="text-xs text-muted-foreground mt-0.5">{new Date(e.timestamp).toLocaleTimeString()}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="metric-card"><div className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-warning" /><h3 className="text-sm font-medium">Root Cause Analysis</h3></div><p className="text-sm leading-relaxed">{diagnostic.rootCause}</p></div>

      <div className="metric-card">
        <div className="flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-success" /><h3 className="text-sm font-medium">Recommended Actions</h3></div>
        <ul className="space-y-2">{diagnostic.recommendations.map((r: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />{r}</li>)}</ul>
      </div>

      {rawFiberData && (
        <div className="metric-card"><details><summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Raw Fiber Response (Developer)</summary><pre className="mt-3 text-xs font-mono bg-accent/30 rounded-lg p-4 overflow-auto max-h-96">{JSON.stringify(rawFiberData, null, 2)}</pre></details></div>
      )}
    </div>
  );
}
