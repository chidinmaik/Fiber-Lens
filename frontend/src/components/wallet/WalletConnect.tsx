"use client";

import { useWallet } from "@/hooks/useWallet";
import { useState, useCallback } from "react";
import {
  Wallet,
  LogOut,
  CheckCircle2,
  X,
  User,
  ChevronRight,
  Copy,
  Check,
  ArrowLeftRight,
  Shield,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { shortenCkbAddress, getAddressNetworkLabel } from "@/lib/ckb-address";

/**
 * WalletConnect — real CKB wallet connection via CCC, plus demo wallet fallback.
 *
 * Connection options:
 *   - Real Wallet (CCC): JoyID, MetaMask, OKX, Neuron, UTXO Global, etc.
 *   - Demo Wallet (Testnet): Instant pre-funded address — no setup needed
 *   - Manual Entry: Paste any CKB address (read-only)
 *
 * Connected state shows:
 *   - Wallet name & CKB address (with copy)
 *   - Network badge (Testnet / Mainnet)
 *   - Address format transformer (testnet ↔ mainnet)
 *   - Disconnect button
 */
export function WalletConnect() {
  const {
    wallet,
    connectWallet,
    connectDemo,
    connectManual,
    disconnect,
    getTestnetAddress,
    getMainnetAddress,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTestnetFormat, setShowTestnetFormat] = useState(true);

  // ── Handlers ──

  const handleConnectReal = useCallback(() => {
    setOpen(false);
    connectWallet();
  }, [connectWallet]);

  const handleConnectDemo = useCallback(() => {
    setOpen(false);
    connectDemo();
  }, [connectDemo]);

  const handleManualConnect = useCallback(() => {
    connectManual(manualAddress.trim(), null);
    setShowManual(false);
    setOpen(false);
  }, [connectManual, manualAddress]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setOpen(false);
  }, [disconnect]);

  // ── Derived display values ──

  const displayAddress = wallet.address
    ? showTestnetFormat
      ? (getTestnetAddress() ?? wallet.address)
      : (getMainnetAddress() ?? wallet.address)
    : null;

  const networkLabel = displayAddress
    ? getAddressNetworkLabel(displayAddress)
    : "Unknown";

  // ── Render: Connected State ──

  if (wallet.connected && wallet.address) {
    return (
      <div className="metric-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Wallet Connected</h3>
            <p className="text-xs text-muted-foreground">
              {wallet.walletName || wallet.connector}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Address Display */}
          <div className="rounded-lg bg-accent/30 border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {networkLabel} Address
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  networkLabel === "Testnet"
                    ? "bg-yellow-600/20 text-yellow-500"
                    : "bg-green-600/20 text-green-400"
                }`}
              >
                <Shield className="h-3 w-3" />
                {networkLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono truncate flex-1">
                {shortenCkbAddress(displayAddress ?? wallet.address, 10)}
              </code>
              <button
                onClick={() => {
                  const addr = displayAddress ?? wallet.address;
                  if (addr) handleCopy(addr);
                }}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Address Format Toggle — only show for CKB addresses */}
          {wallet.address?.startsWith("ckt") || wallet.address?.startsWith("ckb") ? (
            <div className="rounded-lg bg-accent/20 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Transform wallet address format:
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTestnetFormat(true)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    showTestnetFormat
                      ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
                      : "bg-accent/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block text-[10px] opacity-60 mb-0.5">Testnet</span>
                  ckt1...
                </button>
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => setShowTestnetFormat(false)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    !showTestnetFormat
                      ? "bg-green-600/20 text-green-400 border border-green-600/30"
                      : "bg-accent/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block text-[10px] opacity-60 mb-0.5">Mainnet</span>
                  ckb1...
                </button>
              </div>
            </div>
          ) : null}

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Disconnect Wallet
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Disconnected State ──

  return (
    <div className="metric-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600/20">
          <Wallet className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Connect Your CKB Wallet</h3>
          <p className="text-xs text-muted-foreground">
            Real wallets, demo, or manual entry
          </p>
        </div>
      </div>

      {wallet.error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{wallet.error}</p>
        </div>
      )}

      <div className="relative">
        {/* Primary CTA — opens dropdown */}
        <button
          onClick={() => setOpen(!open)}
          disabled={wallet.connecting}
          className="w-full px-6 py-3 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {wallet.connecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {open && !wallet.connecting && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 top-full mt-2 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
              <div className="p-1">
                {/* 1. Demo Wallet — fast & easy */}
                <button
                  onClick={handleConnectDemo}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/20">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Demo Wallet (Testnet)</p>
                    <p className="text-xs text-muted-foreground">
                      Instant pre-funded address — no setup needed
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <div className="border-t border-border my-1" />

                {/* 2. Real wallet via CCC */}
                <button
                  onClick={handleConnectReal}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/20">
                    <Shield className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connect Real Wallet</p>
                    <p className="text-xs text-muted-foreground">
                      JoyID, MetaMask, OKX, Neuron & more via CCC
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <div className="border-t border-border my-1" />

                {/* 3. Manual address entry */}
                <button
                  onClick={() => {
                    setShowManual(true);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/30">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Enter Address Manually</p>
                    <p className="text-xs text-muted-foreground">
                      Paste a CKB testnet or mainnet address (read-only)
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <div className="border-t border-border my-1" />

                <p className="px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
                  Real wallet connections are powered by{" "}
                  <span className="text-info">CCC (Common Chains Connector)</span>.
                  Your keys never leave your wallet.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Connecting overlay */}
        {wallet.connecting && (
          <div className="absolute z-20 top-full mt-2 w-full rounded-lg border border-border bg-card shadow-xl p-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-orange-500" />
            <p className="text-sm text-muted-foreground">Connecting to wallet...</p>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManual && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setShowManual(false)}
          />
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Enter CKB Address</h3>
                <button onClick={() => setShowManual(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Enter a CKB address to view in read-only mode. No signing capability.
              </p>

              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="ckt1qyq... or ckb1qyq..."
                className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent mb-3"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowManual(false)}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualConnect}
                  disabled={!manualAddress.trim()}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium hover:bg-accent/70 transition-all disabled:opacity-50"
                >
                  Use Address
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
