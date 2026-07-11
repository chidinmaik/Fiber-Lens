import {
  ApiResponse,
  PaginatedResponse,
  NormalizedPayment,
  DiagnosticReport,
  InvestigationReport,
  RouteAttempt,
  TimelineEvent,
  PaymentAnalysis,
  AnalyticsOverview,
  FailureAnalytics,
  SystemStatus,
  SyncResult,
} from "./types";

/**
 * REST API client for the Fiber Lens server.
 *
 * Use this when you have a Lens instance running and want to query
 * its diagnostics, analytics, and payment data from your own application.
 *
 * Works in both browser and Node.js (18+). Zero dependencies.
 *
 * @example
 * ```ts
 * import { Lens } from "@fiber/lens-sdk";
 *
 * const lens = new Lens({ baseUrl: "http://localhost:3001" });
 *
 * // Analyze any payment by hash
 * const report = await lens.analyze("0xabc123...");
 * console.log(report.category, report.recommendations);
 *
 * // List failed payments
 * const { items } = await lens.payments.list({ status: "Failed" });
 * ```
 */
export class Lens {
  private baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:3001";
  }

  // ─── HTTP Helpers ───

  private async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v));
      });
    }
    const res = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });
    const body: ApiResponse<T> = await res.json();
    if (!body.success) throw new Error(body.error || `HTTP ${res.status}`);
    return body.data as T;
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: ApiResponse<T> = await res.json();
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data.data as T;
  }

  // ─── Payments ───

  payments = {
    /**
     * List payments with pagination, filtering, and sorting.
     */
    list: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      search?: string;
      sort?: string;
      order?: string;
    }): Promise<PaginatedResponse<NormalizedPayment>> => {
      return this.get("/payments", params as Record<string, string | number | undefined>);
    },

    /**
     * Get a single payment with its full investigation report
     * (diagnostic + route attempts + timeline).
     */
    get: (hash: string): Promise<InvestigationReport> => {
      return this.get(`/payments/${hash}`);
    },

    /**
     * Analyze any payment by hash. If the payment isn't in the local DB,
     * Lens fetches it from Fiber, runs diagnostics, and returns the result.
     *
     * This is the primary integration point for wallets, merchants, and node operators.
     */
    analyze: (hash: string): Promise<PaymentAnalysis> => {
      return this.post("/payments/analyze", { payment_hash: hash });
    },

    /**
     * Get all diagnostics for a payment (most recent first).
     */
    diagnostics: (hash: string): Promise<DiagnosticReport[]> => {
      return this.get(`/payments/${hash}/diagnostics`);
    },

    /**
     * Get all route attempts for a payment with full node-level detail.
     */
    attempts: (hash: string): Promise<RouteAttempt[]> => {
      return this.get(`/payments/${hash}/attempts`);
    },

    /**
     * Get timeline events for a payment.
     */
    timeline: (hash: string): Promise<TimelineEvent[]> => {
      return this.get(`/payments/${hash}/timeline`);
    },
  };

  // ─── Diagnostics ───

  diagnostics = {
    /**
     * List all diagnostics with pagination and filtering.
     */
    list: (params?: {
      page?: number;
      limit?: number;
      category?: string;
      severity?: string;
      sort?: string;
      order?: string;
    }): Promise<PaginatedResponse<DiagnosticReport>> => {
      return this.get("/diagnostics", params as Record<string, string | number | undefined>);
    },

    /**
     * Get a single diagnostic by ID, including its associated payment info.
     */
    get: (
      id: string
    ): Promise<
      DiagnosticReport & {
        payment: {
          paymentHash: string;
          status: string;
          failedError: string | null;
        };
      }
    > => {
      return this.get(`/diagnostics/${id}`);
    },
  };

  // ─── Analytics ───

  analytics = {
    /**
     * High-level dashboard metrics.
     */
    overview: (): Promise<AnalyticsOverview> => {
      return this.get("/analytics/overview");
    },

    /**
     * Failure breakdown by category, severity, and retryability buckets.
     */
    failuresByCategory: (): Promise<FailureAnalytics> => {
      return this.get("/analytics/failures-by-category");
    },

    /**
     * Most recent failure diagnostics.
     */
    recentFailures: (
      limit?: number
    ): Promise<
      Array<{
        diagnosticId: string;
        paymentHash: string;
        category: string;
        severity: string;
        retryability: number;
        confidence: number;
        summary: string;
        failedError: string | null;
        paymentCreatedAt: number;
        diagnosticCreatedAt: number;
      }>
    > => {
      return this.get("/analytics/recent-failures", { limit });
    },
  };

  // ─── System ───

  system = {
    /**
     * Full system status: Fiber RPC connectivity, sync config, DB stats.
     */
    status: (): Promise<SystemStatus> => {
      return this.get("/system/status");
    },

    /**
     * Health check with uptime and version.
     */
    health: (): Promise<{
      status: string;
      version: string;
      uptime: number;
      timestamp: number;
    }> => {
      return this.get("/system/health");
    },

    /**
     * Test connectivity to a Fiber RPC endpoint.
     */
    testConnection: (
      rpcUrl: string
    ): Promise<{ connected: boolean; rpcUrl: string; error?: string }> => {
      return this.post("/system/test-connection", { rpcUrl });
    },

    /**
     * Trigger a manual sync with the Fiber node.
     */
    sync: (): Promise<SyncResult> => {
      return this.post("/system/sync");
    },
  };
}
