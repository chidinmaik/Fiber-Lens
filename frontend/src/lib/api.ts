const API_BASE = "/api";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Unknown API error");
  }

  return data.data as T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  cursor?: string;
}

export interface NormalizedPayment {
  paymentHash: string;
  status: string;
  amount: string;
  fee: string;
  createdAt: number;
  updatedAt: number;
  failedError: string | null;
  failureCode: string | null;
  failureCategory: string | null;
  customRecords: Record<string, string> | null;
}

export interface DiagnosticReport {
  id?: string;
  paymentHash: string;
  category: string;
  severity: string;
  retryability: number;
  confidence: number;
  summary: string;
  rootCause: string;
  recommendations: string[];
  createdAt?: number;
}

export interface RouteNode {
  pubkey: string;
  channelOutpoint: string;
  amount: string;
}

export interface RouteAttempt {
  id?: string;
  paymentHash: string;
  attemptIndex: number;
  hopCount: number;
  failingHop: number | null;
  failingNode: string | null;
  failingChannel: string | null;
  status: string;
  failureReason: string | null;
  routeNodes: RouteNode[];
}

export interface TimelineEvent {
  timestamp: number;
  event: string;
  description: string;
}

export interface InvestigationReport {
  payment: NormalizedPayment;
  diagnostic: DiagnosticReport;
  routeAttempts: RouteAttempt[];
  timeline: TimelineEvent[];
  rawFiberData: unknown;
}

export interface DashboardMetrics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  successRate: number;
  failureByCategory: Record<string, number>;
  severityDistribution: Record<string, number>;
  retryabilityBuckets: Record<string, number>;
  recentFailures: Array<{
    paymentHash: string;
    category: string;
    severity: string;
    retryability: number;
    summary: string;
    failedError: string | null;
    createdAt: number;
  }>;
}

// ─── API Methods ───

export async function getPayments(
  page = 1,
  pageSize = 20,
  status?: string,
  search?: string
): Promise<PaginatedResponse<NormalizedPayment>> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return fetchApi(`/payments?${params.toString()}`);
}

export async function getInvestigationReport(
  paymentHash: string
): Promise<InvestigationReport> {
  return fetchApi(`/payments/${paymentHash}`);
}

export async function getDiagnosticsSummary(): Promise<{
  metrics: {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    successRate: number;
  };
  failureByCategory: Record<string, number>;
  severityDistribution: Record<string, number>;
  retryabilityBuckets: Record<string, number>;
  recentFailures: DashboardMetrics["recentFailures"];
}> {
  return fetchApi("/diagnostics/summary");
}

export async function triggerSync(): Promise<{ imported: number; skipped: number }> {
  return fetchApi("/sync", { method: "POST" });
}
