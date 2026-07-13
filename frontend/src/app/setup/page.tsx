"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PaginatedList, Payment, SystemStatus } from "@/lib/api-client";
import { useWallet } from "@/hooks/useWallet";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { Radio, Server, Database, ArrowRight, Loader2, CheckCircle2, XCircle, Zap, Wallet } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const { wallet } = useWallet();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [rpcUrl, setRpcUrl] = useState("http://localhost:8227");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null);
  const [demoDataExists, setDemoDataExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.system.status(),
      api.payments.list({ limit: 1 }),
    ]).then(([s, payments]: [SystemStatus, PaginatedList<Payment>]) => {
      setStatus(s);
      setDemoDataExists(payments.total > 0);
      // If wallet connected AND fiber connected or has data, skip to dashboard
      // Don't auto-redirect — let the user choose when to proceed
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router, wallet.connected]);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.system.testConnection(rpcUrl);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ connected: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const goToDashboard = () => router.push("/");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background">
              <Radio className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Fiber Black Box</h1>
          <p className="text-muted-foreground">
            Payment Flight Recorder for Fiber Network
          </p>
        </div>

        {/* Step 1: Connect Wallet (MUST come first) */}
        <div className="metric-card border-info/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-info/20 text-xs font-medium text-info">1</span>
            <h3 className="text-sm font-medium">Connect Your Wallet</h3>
          </div>
          <WalletConnect />
        </div>

        {/* Step 2: Connect Fiber Node (shown after wallet connected) */}
        {wallet.connected && (
          <>
            {/* Demo Data Option */}
            {demoDataExists && (
              <div className="metric-card border-success/30">
                <div className="flex items-center gap-3 mb-3">
                  <Database className="h-5 w-5 text-success" />
                  <div>
                    <h3 className="text-sm font-medium">Demo Data Available</h3>
                    <p className="text-xs text-muted-foreground">Sample payments ready to explore</p>
                  </div>
                </div>
                <button onClick={goToDashboard}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm font-medium text-success hover:bg-success/20 transition-all">
                  Explore Demo Data <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or connect a node</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Step 2: Connect Fiber Node */}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-info/20 text-xs font-medium text-info">2</span>
                <h3 className="text-sm font-medium">Connect Your Fiber Node</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">RPC Endpoint</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={rpcUrl}
                      onChange={(e) => setRpcUrl(e.target.value)}
                      placeholder="http://localhost:8227"
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      onClick={testConnection}
                      disabled={testing}
                      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium hover:bg-accent/70 disabled:opacity-50 transition-all"
                    >
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      {testing ? "Testing..." : "Test"}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg border ${testResult.connected ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.connected ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <span className={`text-sm ${testResult.connected ? "text-success" : "text-destructive"}`}>
                        {testResult.connected ? "Connection successful! Your Fiber node is reachable." : `Connection failed: ${testResult.error || "Node unreachable"}`}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  The default Fiber testnet RPC runs on <code className="font-mono">localhost:8227</code>.
                  See <span className="text-info">FIBER_NODE_SETUP.md</span> for setup instructions.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Continue anyway */}
        <button onClick={goToDashboard}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent/30 transition-all">
          Continue to Dashboard <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          You can change your wallet and node connection anytime in Settings.
        </p>
      </div>
    </div>
  );
}
