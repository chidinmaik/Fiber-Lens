// Static demo data — used as fallback when the backend API is unreachable.
// Makes the Vercel deployment fully self-contained for hackathon judging.

import type {
  AnalyticsOverview,
  FailureAnalytics,
  NormalizedPayment,
  DiagnosticReport,
  InvestigationReport,
  TimelineEvent,
  RouteAttempt,
  SystemStatus,
  PaginatedResponse,
} from "@fiber/lens-sdk";
import type { RecentFailure } from "./api-client";

export const DEMO_OVERVIEW: AnalyticsOverview = {
  totalPayments: 13,
  successfulPayments: 6,
  failedPayments: 7,
  inflightPayments: 0,
  createdPayments: 0,
  successRate: 46,
  averageFee: 25000,
};

export const DEMO_FAILURE_ANALYTICS: FailureAnalytics = {
  categories: [
    { name: "LiquidityFailure", count: 4 },
    { name: "RoutingFailure", count: 2 },
    { name: "Timeout", count: 2 },
    { name: "PeerOffline", count: 1 },
    { name: "FeeConstraint", count: 1 },
    { name: "InvoiceError", count: 1 },
    { name: "OnionError", count: 1 },
    { name: "UnknownFailure", count: 1 },
  ],
  severity: [
    { name: "Critical", count: 2 },
    { name: "High", count: 4 },
    { name: "Medium", count: 5 },
    { name: "Low", count: 2 },
  ],
  retryabilityBuckets: { "0-25": 3, "26-50": 2, "51-75": 3, "76-100": 5 },
  totalDiagnostics: 13,
};

export const DEMO_RECENT_FAILURES: RecentFailure[] = [
  {
    diagnosticId: "diag-01", paymentHash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    category: "LiquidityFailure", severity: "Medium", retryability: 90, confidence: 94,
    summary: "Insufficient liquidity: TemporaryChannelFailure — insufficient liquidity in channel",
    failedError: "TemporaryChannelFailure: insufficient liquidity in channel",
    paymentCreatedAt: Date.now() - 3600000, diagnosticCreatedAt: Date.now() - 3590000,
  },
  {
    diagnosticId: "diag-02", paymentHash: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    category: "FeeConstraint", severity: "Low", retryability: 65, confidence: 94,
    summary: "Fee limit exceeded: FeeInsufficient — forwarding fee too low for hop",
    failedError: "FeeInsufficient: forwarding fee too low for hop",
    paymentCreatedAt: Date.now() - 7200000, diagnosticCreatedAt: Date.now() - 7190000,
  },
  {
    diagnosticId: "diag-03", paymentHash: "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    category: "RoutingFailure", severity: "High", retryability: 20, confidence: 94,
    summary: "Route unavailable: UnknownNextPeer — next peer in route not found",
    failedError: "UnknownNextPeer: next peer in route not found",
    paymentCreatedAt: Date.now() - 10800000, diagnosticCreatedAt: Date.now() - 10790000,
  },
  {
    diagnosticId: "diag-04", paymentHash: "0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
    category: "Timeout", severity: "Medium", retryability: 55, confidence: 94,
    summary: "Payment timed out: ExpiryTooSoon — TLC expiry too close to current time",
    failedError: "ExpiryTooSoon: TLC expiry too close to current time",
    paymentCreatedAt: Date.now() - 14400000, diagnosticCreatedAt: Date.now() - 14390000,
  },
  {
    diagnosticId: "diag-05", paymentHash: "0xb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
    category: "NetworkFailure", severity: "High", retryability: 75, confidence: 94,
    summary: "Network-level failure: ChannelDisabled — channel has been administratively disabled",
    failedError: "ChannelDisabled: channel has been administratively disabled",
    paymentCreatedAt: Date.now() - 18000000, diagnosticCreatedAt: Date.now() - 17990000,
  },
];

export const DEMO_PAYMENTS: NormalizedPayment[] = [
  { paymentHash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", status: "Failed" as any, amount: "0x5f5e100", fee: "0x3e8", createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3590000, failedError: "TemporaryChannelFailure", failureCode: "TemporaryChannelFailure" as any, failureCategory: "LiquidityFailure" as any, customRecords: null },
  { paymentHash: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3", status: "Failed" as any, amount: "0x3b9aca00", fee: "0x7d0", createdAt: Date.now() - 7200000, updatedAt: Date.now() - 7190000, failedError: "FeeInsufficient", failureCode: "FeeInsufficient" as any, failureCategory: "FeeConstraint" as any, customRecords: null },
  { paymentHash: "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4", status: "Success" as any, amount: "0x1dcd6500", fee: "0x1f4", createdAt: Date.now() - 5000000, updatedAt: Date.now() - 4990000, failedError: null, failureCode: null, failureCategory: null, customRecords: null },
  { paymentHash: "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5", status: "Failed" as any, amount: "0x9502f900", fee: "0x3e8", createdAt: Date.now() - 10800000, updatedAt: Date.now() - 10790000, failedError: "UnknownNextPeer", failureCode: "UnknownNextPeer" as any, failureCategory: "RoutingFailure" as any, customRecords: null },
  { paymentHash: "0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6", status: "Success" as any, amount: "0x4c4b40", fee: "0xfa", createdAt: Date.now() - 14400000, updatedAt: Date.now() - 14390000, failedError: null, failureCode: null, failureCategory: null, customRecords: null },
  { paymentHash: "0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7", status: "Failed" as any, amount: "0x1dcd6500", fee: "0x2bc", createdAt: Date.now() - 18000000, updatedAt: Date.now() - 17990000, failedError: "ExpiryTooSoon", failureCode: "ExpiryTooSoon" as any, failureCategory: "Timeout" as any, customRecords: null },
  { paymentHash: "0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8", status: "Success" as any, amount: "0xbebc200", fee: "0x5dc", createdAt: Date.now() - 21600000, updatedAt: Date.now() - 21590000, failedError: null, failureCode: null, failureCategory: null, customRecords: null },
];

export const DEMO_SYSTEM_STATUS: SystemStatus = {
  fiberRpcUrl: "http://localhost:8227",
  fiberStatus: "disconnected",
  syncEnabled: true,
  syncIntervalMinutes: 5,
  debugMode: false,
  database: { payments: 13, diagnostics: 13 },
  demoDataAvailable: true,
};

export function demoPaymentList(params?: { page?: number; limit?: number; status?: string }): PaginatedResponse<NormalizedPayment> {
  let filtered = [...DEMO_PAYMENTS];
  if (params?.status) filtered = filtered.filter(p => p.status === params.status);
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    pageSize: limit,
    hasMore: start + limit < filtered.length,
  };
}

export function demoPaymentDetail(hash: string): InvestigationReport | null {
  const payment = DEMO_PAYMENTS.find(p => p.paymentHash.startsWith(hash) || p.paymentHash === hash);
  if (!payment) return null;
  const diagnostic: DiagnosticReport = {
    paymentHash: payment.paymentHash,
    category: (payment.failureCategory || "UnknownFailure") as any,
    severity: payment.status === "Failed" ? "Medium" as any : "Low" as any,
    retryability: payment.status === "Failed" ? 50 : 100,
    confidence: 94,
    summary: payment.failedError || "Payment completed successfully",
    rootCause: payment.failedError
      ? `The payment failed due to ${payment.failedError}. This typically indicates a temporary condition that may resolve on retry.`
      : "The payment was routed and settled successfully through the Fiber Network.",
    recommendations: payment.failedError
      ? ["Retry the payment later", "Check channel liquidity", "Verify peer connectivity"]
      : ["No action needed — payment succeeded"],
  };
  const timeline: TimelineEvent[] = [
    { timestamp: payment.createdAt, event: "Payment Created", description: "Payment initiated on Fiber Network" },
    { timestamp: payment.createdAt + 2000, event: "Route Selected", description: "4-hop route selected by pathfinding algorithm" },
    { timestamp: payment.createdAt + 3000, event: "Payment Attempted", description: "HTLC forwarded through the route" },
    { timestamp: payment.updatedAt, event: payment.status === "Success" ? "Payment Succeeded" : "Payment Failed", description: payment.failedError || "Payment settled successfully" },
    { timestamp: payment.updatedAt + 1000, event: "Diagnostic Generated", description: "Fiber Lens analyzed the payment outcome" },
  ];
  const routeAttempts: RouteAttempt[] = [{
    paymentHash: payment.paymentHash,
    attemptIndex: 0,
    hopCount: 4,
    failingHop: payment.status === "Failed" ? 2 : null,
    failingNode: payment.status === "Failed" ? "0x02b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d" : null,
    failingChannel: payment.status === "Failed" ? "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d0000" : null,
    status: payment.status as any,
    failureReason: payment.failedError,
    routeNodes: [
      { pubkey: "0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c", channelOutpoint: "0xa1b2c3d4...0000", amount: "0x5f5e100" },
      { pubkey: "0x02b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", channelOutpoint: "0xb2c3d4e5...0000", amount: "0x5f5e0f0" },
      { pubkey: "0x02c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e", channelOutpoint: "0xc3d4e5f6...0000", amount: "0x5f5e0e0" },
      { pubkey: "0x02d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f", channelOutpoint: "0xd4e5f6a7...0000", amount: "0x5f5e0d0" },
    ],
  }];
  return { payment, diagnostic, routeAttempts, timeline, rawFiberData: null };
}
