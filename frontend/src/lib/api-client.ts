// ─── Fiber Lens API Client ───
// The dashboard is the first consumer of the Lens REST API.
// Types are sourced from @fiber/lens-sdk for consistency.
//
// External developers: use `new Lens({ baseUrl })` from @fiber/lens-sdk directly.
// This module provides a convenience singleton pre-configured for the dashboard.
//
// FALLBACK: When the backend is unreachable (e.g. Vercel deployment without ngrok),
// the API methods fall back to built-in demo data so the dashboard always works.

import type {
  NormalizedPayment,
  DiagnosticReport,
  RouteAttempt as SdkRouteAttempt,
  TimelineEvent as SdkTimelineEvent,
  InvestigationReport as SdkInvestigationReport,
  PaymentAnalysis as SdkPaymentAnalysis,
  AnalyticsOverview as SdkAnalyticsOverview,
  FailureCategoryStat as SdkFailureCategoryStat,
  SeverityStat as SdkSeverityStat,
  FailureAnalytics as SdkFailureAnalytics,
  SystemStatus as SdkSystemStatus,
  SyncResult as SdkSyncResult,
  PaginatedResponse,
  ApiResponse as SdkApiResponse,
} from "@fiber/lens-sdk";
import {
  DEMO_OVERVIEW,
  DEMO_FAILURE_ANALYTICS,
  DEMO_RECENT_FAILURES,
  DEMO_SYSTEM_STATUS,
  demoPaymentList,
  demoPaymentDetail,
} from "./demo-data";

// ─── Re-export with friendly names for frontend components ───

export type ApiResponse<T> = SdkApiResponse<T>;
export type PaginatedList<T> = PaginatedResponse<T>;
export type Payment = NormalizedPayment;
export type Diagnostic = DiagnosticReport;
export type RouteAttempt = SdkRouteAttempt;
export type TimelineEvent = SdkTimelineEvent;
export type InvestigationReport = SdkInvestigationReport;
export type PaymentAnalysis = SdkPaymentAnalysis;
export type AnalyticsOverview = SdkAnalyticsOverview;
export type FailureCategoryStat = SdkFailureCategoryStat;
export type SeverityStat = SdkSeverityStat;
export type FailureAnalytics = SdkFailureAnalytics;
export type SystemStatus = SdkSystemStatus;
export type SyncResult = SdkSyncResult;

export type RouteNode = {
  pubkey: string;
  channelOutpoint: string;
  amount: string;
};

export type RecentFailure = {
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
};

export type ReferenceErrorCode = {
  code: string;
  label: string;
  isPermanent: boolean;
  isNodeError: boolean;
  isChannelError: boolean;
  isOnionError: boolean;
  category: string;
};

export type ReferenceCategory = {
  id: string;
  label: string;
  description: string;
  defaultSeverity: string;
};

export type ReferenceSeverityLevel = {
  level: string;
  description: string;
  color: string;
};

// ─── HTTP Client ───

// In development, we proxy /api/* → localhost:3001 via next.config.js rewrites.
// In production (Vercel), set NEXT_PUBLIC_API_URL to your deployed backend,
// e.g. https://fiber-lens.railway.app
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : "/api/v1";

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const base = this.baseUrl.startsWith("http")
      ? this.baseUrl
      : window.location.origin;
    const url = new URL(`${base}${this.baseUrl.startsWith("http") ? "" : this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v));
      });
    }
    const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || `HTTP ${res.status}`);
    return body.data as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data.data as T;
  }
}

const http = new HttpClient();

// ─── API Methods ───

export const api = {
  payments: {
    async list(params?: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      search?: string;
      sort?: string;
      order?: string;
      address?: string;
    }): Promise<PaginatedResponse<NormalizedPayment>> {
      try {
        return await http.get("/payments", params as Record<string, string | number | undefined>);
      } catch {
        return demoPaymentList(params);
      }
    },

    async analyze(hash: string): Promise<PaymentAnalysis> {
      return http.post("/payments/analyze", { payment_hash: hash });
    },

    async get(hash: string): Promise<InvestigationReport> {
      try {
        return await http.get(`/payments/${hash}`);
      } catch {
        const demo = demoPaymentDetail(hash);
        if (!demo) throw new Error("Payment not found");
        return demo;
      }
    },

    async diagnostics(hash: string): Promise<DiagnosticReport[]> {
      try {
        return await http.get(`/payments/${hash}/diagnostics`);
      } catch {
        return [];
      }
    },

    async attempts(hash: string): Promise<RouteAttempt[]> {
      try {
        return await http.get(`/payments/${hash}/attempts`);
      } catch {
        const demo = demoPaymentDetail(hash);
        return demo?.routeAttempts || [];
      }
    },

    async timeline(hash: string): Promise<TimelineEvent[]> {
      try {
        return await http.get(`/payments/${hash}/timeline`);
      } catch {
        const demo = demoPaymentDetail(hash);
        return demo?.timeline || [];
      }
    },
  },

  diagnostics: {
    async list(params?: {
      page?: number;
      limit?: number;
      category?: string;
      severity?: string;
      sort?: string;
      order?: string;
    }): Promise<PaginatedResponse<DiagnosticReport>> {
      return http.get("/diagnostics", params as Record<string, string | number | undefined>);
    },

    async get(id: string): Promise<DiagnosticReport & { payment: { paymentHash: string; status: string; failedError: string | null } }> {
      return http.get(`/diagnostics/${id}`);
    },
  },

  analytics: {
    async overview(): Promise<AnalyticsOverview> {
      try {
        return await http.get("/analytics/overview");
      } catch {
        return DEMO_OVERVIEW;
      }
    },

    async failuresByCategory(): Promise<FailureAnalytics> {
      try {
        return await http.get("/analytics/failures-by-category");
      } catch {
        return DEMO_FAILURE_ANALYTICS;
      }
    },

    async recentFailures(limit?: number): Promise<RecentFailure[]> {
      try {
        return await http.get("/analytics/recent-failures", { limit });
      } catch {
        return DEMO_RECENT_FAILURES.slice(0, limit || 5);
      }
    },
  },

  reference: {
    errorCodes(): Promise<{ total: number; items: ReferenceErrorCode[] }> {
      return http.get("/reference/error-codes");
    },

    categories(): Promise<{ total: number; items: ReferenceCategory[] }> {
      return http.get("/reference/categories");
    },

    severityLevels(): Promise<{ total: number; items: ReferenceSeverityLevel[] }> {
      return http.get("/reference/severity-levels");
    },
  },

  system: {
    health(): Promise<{ status: string; version: string; uptime: number; timestamp: number }> {
      return http.get("/system/health");
    },

    async status(): Promise<SystemStatus> {
      try {
        return await http.get("/system/status");
      } catch {
        return DEMO_SYSTEM_STATUS;
      }
    },

    testConnection(rpcUrl: string): Promise<{ connected: boolean; rpcUrl: string; error?: string }> {
      return http.post("/system/test-connection", { rpcUrl });
    },

    sync(): Promise<SyncResult> {
      return http.post("/system/sync");
    },
  },
};

export default api;
