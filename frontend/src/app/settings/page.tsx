"use client";

import { useEffect, useState } from "react";
import { api, SystemStatus, SyncResult } from "@/lib/api-client";
import { Settings, RefreshCw, Server, Database, Bug, Radio } from "lucide-react";

export default function SettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    api.system.status().then(setStatus).catch(console.error);
  }, []);

  const handleSync = async () => {
    setSyncing(true); setSyncError(null);
    try { setSyncResult(await api.system.sync()); }
    catch (e) { setSyncError(e instanceof Error ? e.message : "Sync failed"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div><h2 className="text-2xl font-semibold tracking-tight">Settings</h2><p className="text-muted-foreground mt-1">Configure your Fiber Black Box instance</p></div>

      <div className="metric-card">
        <div className="flex items-center gap-3 mb-4">
          <Server className="h-5 w-5 text-info" />
          <div><h3 className="text-sm font-medium">Fiber Connection</h3><p className="text-xs text-muted-foreground">RPC endpoint status</p></div>
        </div>
        {status && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={`flex items-center gap-1 ${status.fiberStatus === "connected" ? "text-success" : "text-destructive"}`}>
                <Radio className="h-3 w-3" /> {status.fiberStatus === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">RPC URL:</span><code className="font-mono text-xs">{status.fiberRpcUrl}</code></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">DB Records:</span><span>{status.database.payments} payments, {status.database.diagnostics} diagnostics</span></div>
          </div>
        )}
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-success" />
          <div><h3 className="text-sm font-medium">Data Sync</h3><p className="text-xs text-muted-foreground">Pull payment data from Fiber</p></div>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium hover:bg-accent/70 disabled:opacity-50 transition-all">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing..." : "Sync Now"}
        </button>
        {syncResult && <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20"><p className="text-sm text-success">Sync complete: {syncResult.imported} imported, {syncResult.skipped} skipped</p></div>}
        {syncError && <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"><p className="text-sm text-destructive">{syncError}</p></div>}
        <p className="text-xs text-muted-foreground mt-3">Auto-sync runs every {status?.syncIntervalMinutes || 5} minutes.</p>
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-3"><Settings className="h-5 w-5 text-muted-foreground" /><div><h3 className="text-sm font-medium">About</h3></div></div>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Fiber Black Box v0.1</p><p>Payment Flight Recorder for Fiber Network</p>
          <p>API: <code className="font-mono text-xs">/api/v1/</code></p>
        </div>
      </div>
    </div>
  );
}
