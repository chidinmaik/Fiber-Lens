"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import type { WalletState } from "@/hooks/useWallet";

// ─── Default / empty wallet state ───

const EMPTY_WALLET: WalletState = {
  connected: false,
  address: null,
  pubkey: null,
  connector: "none",
  connecting: false,
  error: null,
  walletName: null,
  network: "unknown",
};

// ─── Context (always available — never throws) ───

export interface WalletContextValue {
  wallet: WalletState;
  connectWallet: () => void;
  connectDemo: () => Promise<void>;
  connectManual: (address: string, pubkey: string | null) => void;
  disconnect: () => void;
  getTestnetAddress: () => string | null;
  getMainnetAddress: () => string | null;
  getToggledAddress: () => string | null;
  // Internal: allows CccProvider to override the state
  _setCccBridge: (bridge: CccBridge | null) => void;
}

export interface CccBridge {
  client: unknown;
  wallet: { name: string; icon: string } | undefined;
  signerInfo: { name: string; signer: unknown } | undefined;
  open: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}

// ─── Demo wallet constants ───

const DEMO_ADDRESS = "ckt1qrejnmlar3r452tcg57gvq8patctcgy8acync0hxfnyka35ywafvkqgjcxtaqyzlahkfsrke5zh7l6u3f28662lzqqthu46u";
const DEMO_PUBKEY = "0x03c7504eea50b3767c30006897df512a65e4de10a09ff96112f1ce9867160687cb";

// ─── Provider ───

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [cccBridge, setCccBridge] = useState<CccBridge | null>(null);
  const [demoConnected, setDemoConnected] = useState(false);
  const [demoAddress, setDemoAddress] = useState<string | null>(null);
  const [demoPubkey, setDemoPubkey] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCccAddress, setResolvedCccAddress] = useState<string | null>(null);
  const [resolvedCccPubkey, setResolvedCccPubkey] = useState<string | null>(null);

  // Resolve CCC signer address when bridge changes
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const signerInfo = cccBridge?.signerInfo;
      if (!signerInfo) {
        setResolvedCccAddress(null);
        setResolvedCccPubkey(null);
        return;
      }

      try {
        const signer = (signerInfo as any).signer;
        if (!signer) return;

        const isConnected = await signer.isConnected();
        if (!isConnected || cancelled) return;

        // Resolve the CKB address — try multiple methods because
        // different signer types return different formats:
        //
        //   SignerType.CKB  (JoyID, Neuron) → getInternalAddress() returns ckt1... / ckb1...
        //   SignerType.EVM  (MetaMask, OKX) → getInternalAddress() returns 0x... (Ethereum)
        //
        // getRecommendedAddress() always returns a proper CKB address
        // for all signer types, derived from the same key pair.
        let addr: string | null = null;
        try {
          addr = await signer.getRecommendedAddress();
        } catch {
          try {
            const addresses = await signer.getAddresses();
            if (addresses.length > 0) addr = addresses[0];
          } catch {
            // Last resort: raw internal address (may be EVM format)
            addr = await signer.getInternalAddress();
          }
        }

        if (!cancelled && addr) {
          setResolvedCccAddress(addr);
          setConnecting(false);
          setError(null);
        }

        try {
          const identity = await signer.getIdentity();
          if (!cancelled && identity) {
            setResolvedCccPubkey(identity);
          }
        } catch {
          // Not all signers expose pubkey
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to resolve wallet address");
          setConnecting(false);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [cccBridge]);

  // Derive address
  const activeAddress = resolvedCccAddress || demoAddress || manualAddress || null;
  const activePubkey = resolvedCccPubkey || demoPubkey || null;

  // Derive network
  const network = useMemo((): WalletState["network"] => {
    if (resolvedCccAddress) {
      if (resolvedCccAddress.startsWith("ckt")) return "testnet";
      if (resolvedCccAddress.startsWith("ckb")) return "mainnet";
    }
    if (demoAddress?.startsWith("ckt")) return "testnet";
    if (manualAddress?.startsWith("ckt")) return "testnet";
    if (manualAddress?.startsWith("ckb")) return "mainnet";
    return "unknown";
  }, [resolvedCccAddress, demoAddress, manualAddress]);

  // Derive connector
  const connector = useMemo(() => {
    if (cccBridge?.signerInfo) {
      const name = cccBridge.signerInfo.name.toLowerCase();
      if (name.includes("joy")) return "joyid";
      if (name.includes("meta")) return "metamask";
      if (name.includes("okx")) return "okx";
      if (name.includes("neuron")) return "neuron";
      if (name.includes("uni")) return "unisat";
      if (name.includes("xverse")) return "xverse";
      if (name.includes("rei")) return "rei";
      if (name.includes("nostr")) return "nostr";
      if (name.includes("utxo")) return "utxo-global";
      return name || "browser";
    }
    if (demoConnected) return "demo";
    if (manualAddress) return "manual";
    return "none";
  }, [cccBridge, demoConnected, manualAddress]);

  const wallet: WalletState = useMemo(() => ({
    connected: !!cccBridge?.signerInfo || demoConnected || !!manualAddress,
    address: activeAddress,
    pubkey: activePubkey,
    connector,
    connecting,
    error,
    walletName: cccBridge?.wallet?.name ?? (cccBridge?.signerInfo?.name ?? (demoConnected ? "Demo Wallet (Testnet)" : null)),
    network,
  }), [cccBridge, demoConnected, manualAddress, activeAddress, activePubkey, connector, connecting, error, network]);

  // ── Actions ──

  const connectWallet = useCallback(() => {
    if (cccBridge) {
      setConnecting(true);
      setError(null);
      setDemoConnected(false);
      setDemoAddress(null);
      setDemoPubkey(null);
      setManualAddress(null);
      cccBridge.open();
      setTimeout(() => setConnecting(false), 30000);
    }
  }, [cccBridge]);

  const connectDemo = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setManualAddress(null);
    setResolvedCccAddress(null);
    setResolvedCccPubkey(null);
    // Disconnect CCC if connected
    if (cccBridge) {
      cccBridge.disconnect();
    }
    await new Promise((r) => setTimeout(r, 400));
    setDemoConnected(true);
    setDemoAddress(DEMO_ADDRESS);
    setDemoPubkey(DEMO_PUBKEY);
    setConnecting(false);
  }, [cccBridge]);

  const connectManual = useCallback(
    (address: string, _pubkey: string | null) => {
      if (!address || address.length < 10) {
        setError("Enter a valid CKB address (starts with ckt1... or ckb1...)");
        return;
      }
      if (!address.startsWith("ckt1") && !address.startsWith("ckb1")) {
        setError("Not a valid CKB address. Must start with ckt1 or ckb1.");
        return;
      }
      setError(null);
      setDemoConnected(false);
      setDemoAddress(null);
      setDemoPubkey(null);
      setResolvedCccAddress(null);
      setResolvedCccPubkey(null);
      setManualAddress(address);
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (cccBridge) {
      cccBridge.disconnect();
    }
    setDemoConnected(false);
    setDemoAddress(null);
    setDemoPubkey(null);
    setManualAddress(null);
    setResolvedCccAddress(null);
    setResolvedCccPubkey(null);
    setConnecting(false);
    setError(null);
  }, [cccBridge]);

  // ── Address transformation ──

  const getTestnetAddress = useCallback((): string | null => {
    const addr = activeAddress;
    if (!addr) return null;
    if (addr.startsWith("ckt")) return addr;
    if (addr.startsWith("ckb")) return "ckt" + addr.slice(3);
    return addr;
  }, [activeAddress]);

  const getMainnetAddress = useCallback((): string | null => {
    const addr = activeAddress;
    if (!addr) return null;
    if (addr.startsWith("ckb") && !addr.startsWith("ckt")) return addr;
    if (addr.startsWith("ckt")) return "ckb" + addr.slice(3);
    return addr;
  }, [activeAddress]);

  const getToggledAddress = useCallback((): string | null => {
    const addr = activeAddress;
    if (!addr) return null;
    if (addr.startsWith("ckt")) return "ckb" + addr.slice(3);
    if (addr.startsWith("ckb")) return "ckt" + addr.slice(3);
    return addr;
  }, [activeAddress]);

  const value: WalletContextValue = useMemo(() => ({
    wallet,
    connectWallet,
    connectDemo,
    connectManual,
    disconnect,
    getTestnetAddress,
    getMainnetAddress,
    getToggledAddress,
    _setCccBridge: setCccBridge,
  }), [wallet, connectWallet, connectDemo, connectManual, disconnect, getTestnetAddress, getMainnetAddress, getToggledAddress]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
