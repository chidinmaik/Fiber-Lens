"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api, SystemStatus } from "@/lib/api-client";
import {
  type LucideIcon,
  LayoutDashboard,
  CreditCard,
  Activity,
  Settings,
  Radio,
  Plug,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/diagnostics", label: "Diagnostics", icon: Activity },
  { href: "/setup", label: "Setup", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [fiberConnected, setFiberConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.system.status().then((s: SystemStatus) => setFiberConnected(s.fiberStatus === "connected")).catch(() => {});
    const interval = setInterval(() => {
      api.system.status().then((s: SystemStatus) => setFiberConnected(s.fiberStatus === "connected")).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <div className="p-6 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Fiber</h1>
            <p className="text-xs text-muted-foreground">Lens</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item: NavItem) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <div className={`h-2 w-2 rounded-full ${
            fiberConnected === null ? "bg-muted-foreground" :
            fiberConnected ? "bg-success" : "bg-destructive"
          }`} />
          <span className="text-muted-foreground">
            {fiberConnected === null ? "Checking..." :
             fiberConnected ? "Fiber Connected" : "Fiber Disconnected"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">v0.1 — Testnet</p>
      </div>
    </aside>
  );
}
