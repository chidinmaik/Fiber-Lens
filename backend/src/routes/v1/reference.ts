import { Router, Request, Response } from "express";
import { TlcErrorCode, FailureCategory, Severity } from "../../types";

const router = Router();

function ok<T>(data: T) {
  return { success: true, data };
}

// ─── GET /api/v1/reference/error-codes ───
// Returns all 25 Fiber TLC error codes with metadata.
router.get("/error-codes", (_req: Request, res: Response) => {
  const codes = Object.values(TlcErrorCode).map((code) => ({
    code,
    label: code.replace(/([A-Z])/g, " $1").trim(),
    isPermanent: code.includes("Permanent") || code.includes("Invalid") || code.includes("Expired") || code.includes("Cancelled") || code.includes("UnknownNextPeer") || code.includes("HoldTlcTimeout") || code.includes("IncorrectTlcDirection"),
    isNodeError: code.includes("Node"),
    isChannelError: code.includes("Channel"),
    isOnionError: code.includes("Onion"),
    category: mapErrorCodeToCategory(code as TlcErrorCode),
  }));

  res.json(ok({
    total: codes.length,
    items: codes,
  }));
});

// ─── GET /api/v1/reference/categories ───
// Returns all diagnostic categories with descriptions.
router.get("/categories", (_req: Request, res: Response) => {
  const categories = Object.values(FailureCategory).map((cat) => ({
    id: cat,
    label: cat.replace(/([A-Z])/g, " $1").trim(),
    description: getCategoryDescription(cat),
    defaultSeverity: getDefaultSeverity(cat),
  }));

  res.json(ok({ total: categories.length, items: categories }));
});

// ─── GET /api/v1/reference/severity-levels ───
router.get("/severity-levels", (_req: Request, res: Response) => {
  const levels = Object.values(Severity).map((s) => ({
    level: s,
    description: getSeverityDescription(s),
    color: s === "Critical" ? "red" : s === "High" ? "orange" : s === "Medium" ? "yellow" : "green",
  }));

  res.json(ok({ total: levels.length, items: levels }));
});

// ─── Helpers ───

function mapErrorCodeToCategory(code: TlcErrorCode): FailureCategory {
  const map: Partial<Record<TlcErrorCode, FailureCategory>> = {
    [TlcErrorCode.TemporaryChannelFailure]: FailureCategory.LiquidityFailure,
    [TlcErrorCode.AmountBelowMinimum]: FailureCategory.LiquidityFailure,
    [TlcErrorCode.FeeInsufficient]: FailureCategory.FeeConstraint,
    [TlcErrorCode.UnknownNextPeer]: FailureCategory.RoutingFailure,
    [TlcErrorCode.PermanentChannelFailure]: FailureCategory.RoutingFailure,
    [TlcErrorCode.ChannelDisabled]: FailureCategory.NetworkFailure,
    [TlcErrorCode.RequiredChannelFeatureMissing]: FailureCategory.RoutingFailure,
    [TlcErrorCode.RequiredNodeFeatureMissing]: FailureCategory.RoutingFailure,
    [TlcErrorCode.ExpiryTooSoon]: FailureCategory.Timeout,
    [TlcErrorCode.ExpiryTooFar]: FailureCategory.Timeout,
    [TlcErrorCode.IncorrectTlcExpiry]: FailureCategory.Timeout,
    [TlcErrorCode.FinalIncorrectExpiryDelta]: FailureCategory.Timeout,
    [TlcErrorCode.HoldTlcTimeout]: FailureCategory.Timeout,
    [TlcErrorCode.TemporaryNodeFailure]: FailureCategory.PeerOffline,
    [TlcErrorCode.PermanentNodeFailure]: FailureCategory.PeerOffline,
    [TlcErrorCode.IncorrectOrUnknownPaymentDetails]: FailureCategory.InvoiceError,
    [TlcErrorCode.InvoiceExpired]: FailureCategory.InvoiceError,
    [TlcErrorCode.InvoiceCancelled]: FailureCategory.InvoiceError,
    [TlcErrorCode.FinalIncorrectTlcAmount]: FailureCategory.InvoiceError,
    [TlcErrorCode.InvalidOnionVersion]: FailureCategory.OnionError,
    [TlcErrorCode.InvalidOnionHmac]: FailureCategory.OnionError,
    [TlcErrorCode.InvalidOnionKey]: FailureCategory.OnionError,
    [TlcErrorCode.InvalidOnionPayload]: FailureCategory.OnionError,
    [TlcErrorCode.InvalidOnionError]: FailureCategory.OnionError,
    [TlcErrorCode.IncorrectTlcDirection]: FailureCategory.OnionError,
  };
  return map[code] || FailureCategory.UnknownFailure;
}

function getCategoryDescription(cat: FailureCategory): string {
  const descriptions: Record<string, string> = {
    LiquidityFailure: "Insufficient liquidity available for payment execution. A node along the route lacks sufficient balance to forward the payment.",
    RoutingFailure: "No valid route available. The network could not construct a viable path to the destination.",
    Timeout: "Payment exceeded execution window. The HTLC expiry was too soon, too far, or the payment was held too long.",
    PeerOffline: "Required peer unavailable. A node along the route is not reachable.",
    FeeConstraint: "Route exceeded configured fee limits. The forwarding fees required exceed the sender's maximum.",
    NetworkFailure: "Network-level failure. Channel disabled, unavailable, or protocol constraints violated.",
    InvoiceError: "Invoice validation failed. The invoice is expired, cancelled, or contains incorrect details.",
    OnionError: "Onion routing packet error. The onion packet was malformed or could not be decoded.",
    UnknownFailure: "The failure reason could not be classified into a known category.",
  };
  return descriptions[cat] || "Unknown failure category.";
}

function getDefaultSeverity(cat: FailureCategory): Severity {
  const map: Record<string, Severity> = {
    LiquidityFailure: Severity.Medium,
    RoutingFailure: Severity.High,
    Timeout: Severity.Medium,
    PeerOffline: Severity.High,
    FeeConstraint: Severity.Low,
    NetworkFailure: Severity.High,
    InvoiceError: Severity.Medium,
    OnionError: Severity.Critical,
    UnknownFailure: Severity.Medium,
  };
  return map[cat] || Severity.Medium;
}

function getSeverityDescription(level: Severity): string {
  const map: Record<string, string> = {
    Low: "Minor issue. Payment will likely succeed on retry with small adjustments.",
    Medium: "Moderate issue. Payment may succeed with retry or operational changes.",
    High: "Serious issue. Requires investigation and likely configuration or network changes.",
    Critical: "Critical failure. Payment cannot succeed without fundamental changes to the route or network state.",
  };
  return map[level] || "";
}

export default router;
