// ─── @fiber/lens-sdk ───
// Canonical types for Fiber Network payment observability.
// Single source of truth — backend, frontend, and external consumers all import from here.

// ─── Payment Status ───
export enum PaymentStatus {
  Created = "Created",
  Inflight = "Inflight",
  Success = "Success",
  Failed = "Failed",
}

// ─── Diagnostic Categories ───
export enum FailureCategory {
  LiquidityFailure = "LiquidityFailure",
  RoutingFailure = "RoutingFailure",
  Timeout = "Timeout",
  PeerOffline = "PeerOffline",
  FeeConstraint = "FeeConstraint",
  NetworkFailure = "NetworkFailure",
  InvoiceError = "InvoiceError",
  OnionError = "OnionError",
  UnknownFailure = "UnknownFailure",
}

// ─── Severity ───
export enum Severity {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical",
}

// ─── TLC Error Codes (canonical 25, from Fiber source) ───
export enum TlcErrorCode {
  TemporaryNodeFailure = "TemporaryNodeFailure",
  PermanentNodeFailure = "PermanentNodeFailure",
  RequiredNodeFeatureMissing = "RequiredNodeFeatureMissing",
  InvalidOnionVersion = "InvalidOnionVersion",
  InvalidOnionHmac = "InvalidOnionHmac",
  InvalidOnionKey = "InvalidOnionKey",
  TemporaryChannelFailure = "TemporaryChannelFailure",
  PermanentChannelFailure = "PermanentChannelFailure",
  RequiredChannelFeatureMissing = "RequiredChannelFeatureMissing",
  UnknownNextPeer = "UnknownNextPeer",
  AmountBelowMinimum = "AmountBelowMinimum",
  FeeInsufficient = "FeeInsufficient",
  IncorrectTlcExpiry = "IncorrectTlcExpiry",
  ExpiryTooSoon = "ExpiryTooSoon",
  IncorrectOrUnknownPaymentDetails = "IncorrectOrUnknownPaymentDetails",
  InvoiceExpired = "InvoiceExpired",
  InvoiceCancelled = "InvoiceCancelled",
  FinalIncorrectExpiryDelta = "FinalIncorrectExpiryDelta",
  FinalIncorrectTlcAmount = "FinalIncorrectTlcAmount",
  ChannelDisabled = "ChannelDisabled",
  ExpiryTooFar = "ExpiryTooFar",
  InvalidOnionPayload = "InvalidOnionPayload",
  HoldTlcTimeout = "HoldTlcTimeout",
  InvalidOnionError = "InvalidOnionError",
  IncorrectTlcDirection = "IncorrectTlcDirection",
}

// ─── Fiber RPC Response Types ───
export interface FiberPaymentResult {
  payment_hash: string;
  status: PaymentStatus;
  created_at: string;
  last_updated_at: string;
  failed_error: string | null;
  fee: string;
  routers?: FiberSessionRoute[];
  custom_records?: Record<string, string> | null;
}

export interface FiberSessionRoute {
  nodes: FiberSessionRouteNode[];
}

export interface FiberSessionRouteNode {
  pubkey: string;
  amount: string;
  channel_outpoint: string;
}

export interface FiberListPaymentsResult {
  payments: FiberPaymentResult[];
  last_cursor: string | null;
}

// ─── Normalized Payment Record ───
export interface NormalizedPayment {
  paymentHash: string;
  status: PaymentStatus;
  amount: string;
  fee: string;
  createdAt: number;
  updatedAt: number;
  failedError: string | null;
  failureCode: TlcErrorCode | null;
  failureCategory: FailureCategory | null;
  customRecords: Record<string, string> | null;
}

// ─── Diagnostic Report ───
export interface DiagnosticReport {
  id?: string;
  paymentHash: string;
  category: FailureCategory;
  severity: Severity;
  retryability: number; // 0–100
  confidence: number; // 0–100
  summary: string;
  rootCause: string;
  recommendations: string[];
  createdAt?: number;
}

// ─── Route Attempt ───
export interface RouteAttempt {
  id?: string;
  paymentHash: string;
  attemptIndex: number;
  hopCount: number;
  failingHop: number | null;
  failingNode: string | null;
  failingChannel: string | null;
  status: "Success" | "Failed" | "Inflight";
  failureReason: string | null;
  routeNodes: RouteNode[];
}

export interface RouteNode {
  pubkey: string;
  channelOutpoint: string;
  amount: string;
}

// ─── Investigation Report ───
export interface InvestigationReport {
  payment: NormalizedPayment;
  diagnostic: DiagnosticReport;
  routeAttempts: RouteAttempt[];
  timeline: TimelineEvent[];
  rawFiberData: FiberPaymentResult | null;
}

export interface TimelineEvent {
  timestamp: number;
  event: string;
  description: string;
}

// ─── Dashboard Metrics ───
export interface DashboardMetrics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  successRate: number;
  failureByCategory: Record<string, number>;
  averageFee: string;
  recentPayments: NormalizedPayment[];
}

// ─── API Response Wrapper ───
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  meta?: Record<string, unknown>;
}

// ─── Pagination ───
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  cursor?: string;
}

// ─── Black Box REST API Response Types ───
export interface PaymentAnalysis {
  payment_hash: string;
  status: string;
  category: string;
  severity: string;
  retryability: number;
  confidence: number;
  failed_hop: number | null;
  failing_node: string | null;
  failing_channel: string | null;
  total_hops: number | null;
  summary: string;
  root_cause: string;
  recommendations: string[];
  fiber_error: string | null;
}

export interface AnalyticsOverview {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  inflightPayments: number;
  createdPayments: number;
  successRate: number;
  averageFee: number;
}

export interface FailureCategoryStat {
  name: string;
  count: number;
}

export interface SeverityStat {
  name: string;
  count: number;
}

export interface FailureAnalytics {
  categories: FailureCategoryStat[];
  severity: SeverityStat[];
  retryabilityBuckets: Record<string, number>;
  totalDiagnostics: number;
}

export interface SystemStatus {
  fiberRpcUrl: string;
  fiberStatus: "connected" | "disconnected" | "unknown";
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  debugMode: boolean;
  database: { payments: number; diagnostics: number };
  demoDataAvailable?: boolean;
}

export interface SyncResult {
  imported: number;
  skipped: number;
  timestamp: number;
}
