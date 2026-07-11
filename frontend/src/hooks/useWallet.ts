"use client";

import { useWalletContext } from "@/components/wallet/WalletProvider";

// ─── Types (re-exported for convenience) ───

export interface WalletState {
  /** Whether a wallet is currently connected. */
  connected: boolean;
  /** The CKB address from the connected wallet (testnet or mainnet). */
  address: string | null;
  /** Public key hash (when available from the signer). */
  pubkey: string | null;
  /** The wallet connector type (e.g., "joyid", "metamask", "demo", "manual"). */
  connector: string;
  /** True while a connection attempt is in progress. */
  connecting: boolean;
  /** Last connection error message, if any. */
  error: string | null;
  /** Human-readable wallet name (e.g., "JoyID", "MetaMask", "Demo Wallet (Testnet)"). */
  walletName: string | null;
  /** The network the address is on ("testnet" | "mainnet" | "unknown"). */
  network: "testnet" | "mainnet" | "unknown";
}

// ─── Hook ───

/**
 * useWallet — unified wallet state hook.
 *
 * Supports three connection modes:
 *   1. Real wallet via CCC (JoyID, MetaMask, OKX, Neuron, etc.) — requires CCC Provider
 *   2. Demo wallet — instant, pre-funded CKB testnet address (no setup needed)
 *   3. Manual address entry — paste any CKB address for read-only mode
 *
 * Safe to use during SSR (returns disconnected state when CCC isn't loaded yet).
 */
export function useWallet() {
  const ctx = useWalletContext();

  return {
    wallet: ctx.wallet,
    // Primary actions
    connectWallet: ctx.connectWallet,
    connectDemo: ctx.connectDemo,
    connectManual: ctx.connectManual,
    disconnect: ctx.disconnect,
    // Address utilities
    getTestnetAddress: ctx.getTestnetAddress,
    getMainnetAddress: ctx.getMainnetAddress,
    getToggledAddress: ctx.getToggledAddress,
    // Legacy-compatible aliases (for existing components)
    connectJoyID: ctx.connectWallet,
    connectBrowserWallet: ctx.connectWallet,
  };
}
