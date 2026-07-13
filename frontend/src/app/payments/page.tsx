"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { api, PaginatedList, Payment } from "@/lib/api-client";
import { Search, RefreshCw, Wallet } from "lucide-react";

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const { wallet } = useWallet();
  const [data, setData] = useState<PaginatedList<Payment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  useEffect(() => {
    setLoading(true);
    api.payments.list({
      page,
      limit: 20,
      status: statusFilter || undefined,
      search: search || undefined,
      address: wallet.connected ? (wallet.address ?? undefined) : undefined,
    })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, statusFilter, search, wallet.address, wallet.connected]);

  const statusBadge = (s: string) => `status-badge ${({ Success: "status-success", Failed: "status-failed", Inflight: "status-inflight" }[s] || "status-created")}`;

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-semibold tracking-tight">Payments</h2><p className="text-muted-foreground mt-1">Browse and investigate payment history</p></div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by payment hash..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">All Statuses</option>
          <option value="Success">Success</option><option value="Failed">Failed</option>
          <option value="Inflight">Inflight</option><option value="Created">Created</option>
        </select>
      </div>

      {loading ? <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      : data && data.items.length > 0 ? <>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="data-table">
            <thead><tr className="border-b border-border"><th>Payment Hash</th><th>Status</th><th>Fee</th><th>Category</th><th>Created</th></tr></thead>
            <tbody>
              {data.items.map((p: Payment) => (
                <tr key={p.paymentHash}>
                  <td><Link href={`/payments/${p.paymentHash}`} className="hash-text text-info hover:underline">{p.paymentHash.slice(0, 16)}...</Link></td>
                  <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                  <td className="font-mono text-sm">{p.fee}</td>
                  <td><span className="text-sm text-muted-foreground">{p.failureCategory || "—"}</span></td>
                  <td className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page-1)*20+1}–{Math.min(page*20, data.total)} of {data.total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(page-1)} disabled={page===1} className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent">Previous</button>
            <button onClick={() => setPage(page+1)} disabled={!data.hasMore} className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent">Next</button>
          </div>
        </div>
      </> : <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><p>No payments found</p><p className="text-sm">Use Settings → Sync Now or run seed data</p></div>}
    </div>
  );
}
