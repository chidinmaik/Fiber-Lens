"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ReactNode, useEffect, useMemo } from "react";
import { useWalletContext, type CccBridge } from "./WalletProvider";

/**
 * Internal component that reads CCC state and bridges it into WalletProvider.
 * This MUST be rendered inside <ccc.Provider> (via CccProviderShell).
 */
function CccBridge({ children }: { children: ReactNode }) {
  const { client, wallet, signerInfo, open, disconnect } = ccc.useCcc();
  const { _setCccBridge } = useWalletContext();

  const bridge: CccBridge = useMemo(
    () => ({
      client,
      wallet,
      signerInfo: signerInfo
        ? { name: signerInfo.name, signer: signerInfo.signer }
        : undefined,
      open,
      disconnect,
    }),
    [client, wallet, signerInfo, open, disconnect],
  );

  useEffect(() => {
    _setCccBridge(bridge);
    return () => _setCccBridge(null);
  }, [bridge, _setCccBridge]);

  return <>{children}</>;
}

/**
 * CCC Provider shell — wraps children in real CCC Provider and bridges state.
 * This is dynamically imported with `ssr: false` to avoid SSR crashes
 * (CCC uses Lit web components that need browser APIs).
 */
export function CccProvider({ children }: { children: ReactNode }) {
  const clientOptions = useMemo(
    () => [
      {
        name: "CKB Testnet",
        client: new ccc.ClientPublicTestnet(),
        icon: "🧪",
      },
      {
        name: "CKB Mainnet",
        client: new ccc.ClientPublicMainnet(),
        icon: "🔒",
      },
    ],
    [],
  );

  const preferredNetworks = useMemo(
    () => [
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.CKB,
        network: "ckbTestnet",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.EVM,
        network: "ckbTestnet",
      },
    ],
    [],
  );

  return (
    <ccc.Provider
      name="Fiber Black Box"
      icon="📡"
      clientOptions={clientOptions}
      preferredNetworks={preferredNetworks}
    >
      <CccBridge>{children}</CccBridge>
    </ccc.Provider>
  );
}
