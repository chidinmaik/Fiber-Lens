import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { CccProviderShell } from "@/components/wallet/CccProviderShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Fiber Lens — Payment Flight Recorder",
  description: "Payment observability and diagnostics platform for Fiber Network",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        <WalletProvider>
          <CccProviderShell>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto p-8">{children}</main>
            </div>
          </CccProviderShell>
        </WalletProvider>
      </body>
    </html>
  );
}
