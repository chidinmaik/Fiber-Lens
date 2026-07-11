"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

/**
 * Dynamically imports the real CCC Provider with SSR disabled.
 *
 * CCC uses Lit web components (`<ccc-connector>`) that require
 * browser APIs (customElements). Loading them during SSR causes
 * Next.js to crash with "Internal Server Error".
 *
 * This shell ensures CCC is only loaded on the client, while the
 * WalletProvider fallback context handles disconnected state during SSR.
 */
const CccProviderClient = dynamic(
  () =>
    import("./CccProvider").then((mod) => ({
      default: mod.CccProvider,
    })),
  { ssr: false },
);

export function CccProviderShell({ children }: { children: ReactNode }) {
  return <CccProviderClient>{children}</CccProviderClient>;
}
