import {
  NormalizedPayment,
  DiagnosticReport,
  FailureCategory,
  Severity,
  TlcErrorCode,
} from "./types";

// ─── Classification Mapping Types ───
type ErrorCodeToCategoryMap = Partial<Record<TlcErrorCode, FailureCategory>>;
type ErrorCodeToSeverityMap = Partial<Record<TlcErrorCode, Severity>>;
type ErrorCodeToRetryabilityMap = Partial<Record<TlcErrorCode, number>>;

/**
 * Failure classification engine for Fiber Network payments.
 *
 * Pure logic — zero dependencies, no database, no network.
 * Can be used server-side, client-side, or in edge functions.
 *
 * @example
 * ```ts
 * import { DiagnosticEngine } from "@fiber/lens-sdk";
 *
 * const engine = new DiagnosticEngine();
 * const report = engine.analyze({
 *   paymentHash: "0xabc...",
 *   status: PaymentStatus.Failed,
 *   failedError: "TemporaryChannelFailure: insufficient liquidity",
 *   failureCode: TlcErrorCode.TemporaryChannelFailure,
 *   // ... other fields
 * });
 *
 * console.log(report.category);     // "LiquidityFailure"
 * console.log(report.retryability); // 90
 * console.log(report.recommendations);
 * // ["Retry the payment later", "Rebalance your channels", ...]
 * ```
 */
export class DiagnosticEngine {
  private categoryMap: ErrorCodeToCategoryMap;
  private severityMap: ErrorCodeToSeverityMap;
  private retryabilityMap: ErrorCodeToRetryabilityMap;

  constructor() {
    this.categoryMap = this.buildCategoryMap();
    this.severityMap = this.buildSeverityMap();
    this.retryabilityMap = this.buildRetryabilityMap();
  }

  // ─── Public API ───

  /**
   * Analyze a payment and generate a full diagnostic report.
   * Works for any payment status — if the payment succeeded, category will be unknown.
   */
  analyze(payment: NormalizedPayment): DiagnosticReport {
    const category = this.classify(payment);
    const severity = this.assessSeverity(payment, category);
    const retryability = this.assessRetryability(payment);
    const confidence = this.calculateConfidence(payment);
    const summary = this.generateSummary(category, payment);
    const rootCause = this.generateRootCause(category, payment);
    const recommendations = this.generateRecommendations(category, payment);

    return {
      paymentHash: payment.paymentHash,
      category,
      severity,
      retryability,
      confidence,
      summary,
      rootCause,
      recommendations,
      createdAt: Date.now(),
    };
  }

  // ─── Classification ───

  private classify(payment: NormalizedPayment): FailureCategory {
    if (!payment.failureCode) {
      // Try to infer from the error string
      const err = (payment.failedError || "").toLowerCase();
      if (
        err.includes("liquidity") ||
        err.includes("insufficient") ||
        err.includes("balance")
      ) {
        return FailureCategory.LiquidityFailure;
      }
      if (
        err.includes("route") ||
        err.includes("path") ||
        err.includes("no path")
      ) {
        return FailureCategory.RoutingFailure;
      }
      if (
        err.includes("timeout") ||
        err.includes("expiry") ||
        err.includes("expired")
      ) {
        return FailureCategory.Timeout;
      }
      if (
        err.includes("offline") ||
        err.includes("unavailable") ||
        err.includes("node failure")
      ) {
        return FailureCategory.PeerOffline;
      }
      if (err.includes("fee")) {
        return FailureCategory.FeeConstraint;
      }
      if (err.includes("invoice")) {
        return FailureCategory.InvoiceError;
      }
      if (err.includes("onion")) {
        return FailureCategory.OnionError;
      }
      return FailureCategory.UnknownFailure;
    }

    return (
      this.categoryMap[payment.failureCode] || FailureCategory.UnknownFailure
    );
  }

  private assessSeverity(
    payment: NormalizedPayment,
    category: FailureCategory
  ): Severity {
    if (payment.failureCode && this.severityMap[payment.failureCode]) {
      return this.severityMap[payment.failureCode]!;
    }
    // Default severity by category
    switch (category) {
      case FailureCategory.LiquidityFailure:
        return Severity.Medium;
      case FailureCategory.RoutingFailure:
        return Severity.High;
      case FailureCategory.Timeout:
        return Severity.Medium;
      case FailureCategory.PeerOffline:
        return Severity.High;
      case FailureCategory.FeeConstraint:
        return Severity.Low;
      case FailureCategory.NetworkFailure:
        return Severity.High;
      case FailureCategory.InvoiceError:
        return Severity.Medium;
      case FailureCategory.OnionError:
        return Severity.Critical;
      default:
        return Severity.Medium;
    }
  }

  private assessRetryability(payment: NormalizedPayment): number {
    if (
      payment.failureCode &&
      this.retryabilityMap[payment.failureCode] !== undefined
    ) {
      return this.retryabilityMap[payment.failureCode]!;
    }
    return 50; // default moderate
  }

  private calculateConfidence(payment: NormalizedPayment): number {
    if (payment.failureCode) {
      return 94; // direct match with known error code
    }
    if (payment.failedError && payment.failedError.length > 10) {
      return 72; // string-based heuristic match
    }
    return 45; // low confidence
  }

  // ─── Report Generation ───

  private generateSummary(
    category: FailureCategory,
    payment: NormalizedPayment
  ): string {
    const err = payment.failedError || "Unknown error";
    switch (category) {
      case FailureCategory.LiquidityFailure:
        return `Insufficient liquidity: ${err}`;
      case FailureCategory.RoutingFailure:
        return `Route unavailable: ${err}`;
      case FailureCategory.Timeout:
        return `Payment timed out: ${err}`;
      case FailureCategory.PeerOffline:
        return `Required peer unavailable: ${err}`;
      case FailureCategory.FeeConstraint:
        return `Fee limit exceeded: ${err}`;
      case FailureCategory.NetworkFailure:
        return `Network-level failure: ${err}`;
      case FailureCategory.InvoiceError:
        return `Invoice validation failed: ${err}`;
      case FailureCategory.OnionError:
        return `Onion packet error: ${err}`;
      default:
        return `Payment failed: ${err}`;
    }
  }

  private generateRootCause(
    category: FailureCategory,
    payment: NormalizedPayment
  ): string {
    const code = payment.failureCode || "UnknownError";
    const err = payment.failedError || "No detailed error available";

    const explanations: Record<string, string> = {
      [FailureCategory.LiquidityFailure]: `A node along the payment route did not have sufficient available ${
        code === TlcErrorCode.FeeInsufficient
          ? "balance to forward at the required fee rate"
          : "liquidity to forward the payment"
      }. This typically occurs when channel balances are depleted on one side or when the payment amount exceeds available outbound capacity.`,
      [FailureCategory.RoutingFailure]: `The network could not construct a viable payment route to the destination. ${
        code === TlcErrorCode.UnknownNextPeer
          ? "The next peer specified in the route is unknown to the forwarding node."
          : code === TlcErrorCode.ChannelDisabled
            ? "A required channel has been administratively disabled."
            : "A channel in the route has permanently failed or is missing required features."
      }`,
      [FailureCategory.Timeout]: `The payment exceeded its allowed execution window. ${
        code === TlcErrorCode.ExpiryTooSoon
          ? "The HTLC expiry was set too close to the current time for safe forwarding."
          : code === TlcErrorCode.ExpiryTooFar
            ? "The HTLC expiry exceeds the maximum allowed threshold."
            : "Either the expiry delta was incorrect or the payment was held too long at an intermediate hop."
      }`,
      [FailureCategory.PeerOffline]: `A required node along the payment route is not reachable. ${
        code === TlcErrorCode.PermanentNodeFailure
          ? "This node appears to have permanently failed."
          : "This is likely a temporary connectivity issue."
      }`,
      [FailureCategory.FeeConstraint]: `The configured maximum fee limit was insufficient to cover the forwarding fees required by nodes along the selected route. Consider increasing the fee limit or selecting an alternative route with lower fees.`,
      [FailureCategory.NetworkFailure]: `A network-level failure prevented payment completion. This could be due to channel unavailability, disabled forwarding, or protocol-level constraints on the channel.`,
      [FailureCategory.InvoiceError]: `The invoice associated with this payment was either expired, cancelled, or contains incorrect payment details that do not match the HTLC.`,
      [FailureCategory.OnionError]: `The onion routing packet was malformed or could not be decoded by an intermediate hop. This typically indicates a protocol mismatch or a malicious node tampering with the packet.`,
      [FailureCategory.UnknownFailure]: `The exact failure reason could not be classified. Fiber reported: "${err}". Manual inspection of the payment details is recommended.`,
    };

    return (
      explanations[category] || explanations[FailureCategory.UnknownFailure]
    );
  }

  private generateRecommendations(
    category: FailureCategory,
    _payment: NormalizedPayment
  ): string[] {
    const base: Record<string, string[]> = {
      [FailureCategory.LiquidityFailure]: [
        "Retry the payment later — liquidity conditions may improve",
        "Rebalance your channels to improve outbound liquidity on affected paths",
        "Open additional channels to increase total outbound capacity",
        "Try splitting the payment into smaller amounts (MPP)",
      ],
      [FailureCategory.RoutingFailure]: [
        "Retry the payment — network topology may have changed",
        "Verify connectivity to the target node",
        "Use hop hints to guide routing through known-good channels",
        "Check if the target node supports required features (MPP, trampoline)",
      ],
      [FailureCategory.Timeout]: [
        "Retry the payment with adjusted expiry parameters",
        "Increase the HTLC expiry delta for the final hop",
        "Check for network congestion causing delayed forwarding",
        "Consider using a faster route with fewer hops",
      ],
      [FailureCategory.PeerOffline]: [
        "Wait for the peer to come back online and retry",
        "Verify the peer's network connectivity",
        "Use an alternative route that avoids the offline node",
        "Check node reliability history before routing through it again",
      ],
      [FailureCategory.FeeConstraint]: [
        "Increase the maximum fee limit for this payment",
        "Select an alternative route with lower forwarding fees",
        "Compare fee rates across available channels before sending",
        "Consider using trampoline routing for better fee optimization",
      ],
      [FailureCategory.NetworkFailure]: [
        "Retry the payment — temporary network conditions may have resolved",
        "Check channel state: verify it is active and enabled",
        "Monitor the channel for repeated failures",
        "Consider closing and reopening the problematic channel",
      ],
      [FailureCategory.InvoiceError]: [
        "Verify the invoice has not expired",
        "Request a new invoice from the recipient",
        "Ensure the payment amount matches the invoice amount",
        "Check that the payment hash matches the invoice",
      ],
      [FailureCategory.OnionError]: [
        "Retry the payment — onion errors are often transient",
        "Verify protocol compatibility with intermediate nodes",
        "The error may indicate a malicious or buggy intermediate node",
        "If persistent, consider reporting the node to the network",
      ],
      [FailureCategory.UnknownFailure]: [
        "Review the raw Fiber RPC response for additional details",
        "Inspect channel states and node connectivity manually",
        "Check Fiber node logs for correlated events",
        "If the issue persists, gather data for post-mortem analysis",
      ],
    };

    return base[category] || base[FailureCategory.UnknownFailure];
  }

  // ─── Mapping Builders ───

  private buildCategoryMap(): ErrorCodeToCategoryMap {
    return {
      // Liquidity
      [TlcErrorCode.TemporaryChannelFailure]: FailureCategory.LiquidityFailure,
      [TlcErrorCode.AmountBelowMinimum]: FailureCategory.LiquidityFailure,
      [TlcErrorCode.FeeInsufficient]: FailureCategory.FeeConstraint,

      // Routing
      [TlcErrorCode.UnknownNextPeer]: FailureCategory.RoutingFailure,
      [TlcErrorCode.PermanentChannelFailure]: FailureCategory.RoutingFailure,
      [TlcErrorCode.ChannelDisabled]: FailureCategory.NetworkFailure,
      [TlcErrorCode.RequiredChannelFeatureMissing]:
        FailureCategory.RoutingFailure,
      [TlcErrorCode.RequiredNodeFeatureMissing]:
        FailureCategory.RoutingFailure,

      // Timeout
      [TlcErrorCode.ExpiryTooSoon]: FailureCategory.Timeout,
      [TlcErrorCode.ExpiryTooFar]: FailureCategory.Timeout,
      [TlcErrorCode.IncorrectTlcExpiry]: FailureCategory.Timeout,
      [TlcErrorCode.FinalIncorrectExpiryDelta]: FailureCategory.Timeout,
      [TlcErrorCode.HoldTlcTimeout]: FailureCategory.Timeout,

      // Peer Offline
      [TlcErrorCode.TemporaryNodeFailure]: FailureCategory.PeerOffline,
      [TlcErrorCode.PermanentNodeFailure]: FailureCategory.PeerOffline,

      // Invoice
      [TlcErrorCode.IncorrectOrUnknownPaymentDetails]:
        FailureCategory.InvoiceError,
      [TlcErrorCode.InvoiceExpired]: FailureCategory.InvoiceError,
      [TlcErrorCode.InvoiceCancelled]: FailureCategory.InvoiceError,
      [TlcErrorCode.FinalIncorrectTlcAmount]: FailureCategory.InvoiceError,

      // Onion
      [TlcErrorCode.InvalidOnionVersion]: FailureCategory.OnionError,
      [TlcErrorCode.InvalidOnionHmac]: FailureCategory.OnionError,
      [TlcErrorCode.InvalidOnionKey]: FailureCategory.OnionError,
      [TlcErrorCode.InvalidOnionPayload]: FailureCategory.OnionError,
      [TlcErrorCode.InvalidOnionError]: FailureCategory.OnionError,
      [TlcErrorCode.IncorrectTlcDirection]: FailureCategory.OnionError,
    };
  }

  private buildSeverityMap(): ErrorCodeToSeverityMap {
    return {
      [TlcErrorCode.PermanentChannelFailure]: Severity.High,
      [TlcErrorCode.PermanentNodeFailure]: Severity.Critical,
      [TlcErrorCode.InvalidOnionError]: Severity.Critical,
      [TlcErrorCode.InvoiceExpired]: Severity.Low,
      [TlcErrorCode.InvoiceCancelled]: Severity.Low,
      [TlcErrorCode.FeeInsufficient]: Severity.Low,
      [TlcErrorCode.TemporaryChannelFailure]: Severity.Medium,
      [TlcErrorCode.TemporaryNodeFailure]: Severity.Medium,
      [TlcErrorCode.ExpiryTooSoon]: Severity.Medium,
      [TlcErrorCode.ExpiryTooFar]: Severity.Medium,
      [TlcErrorCode.ChannelDisabled]: Severity.High,
      [TlcErrorCode.UnknownNextPeer]: Severity.High,
    };
  }

  private buildRetryabilityMap(): ErrorCodeToRetryabilityMap {
    return {
      // Highly retryable
      [TlcErrorCode.TemporaryChannelFailure]: 90,
      [TlcErrorCode.TemporaryNodeFailure]: 85,
      [TlcErrorCode.ChannelDisabled]: 75,
      [TlcErrorCode.AmountBelowMinimum]: 70,
      [TlcErrorCode.FeeInsufficient]: 65,

      // Moderately retryable
      [TlcErrorCode.ExpiryTooSoon]: 55,
      [TlcErrorCode.ExpiryTooFar]: 50,
      [TlcErrorCode.IncorrectTlcExpiry]: 45,

      // Low retryability
      [TlcErrorCode.PermanentChannelFailure]: 15,
      [TlcErrorCode.PermanentNodeFailure]: 10,
      [TlcErrorCode.UnknownNextPeer]: 20,
      [TlcErrorCode.RequiredChannelFeatureMissing]: 10,
      [TlcErrorCode.RequiredNodeFeatureMissing]: 10,

      // Not retryable
      [TlcErrorCode.InvoiceExpired]: 5,
      [TlcErrorCode.InvoiceCancelled]: 0,
      [TlcErrorCode.IncorrectOrUnknownPaymentDetails]: 5,
      [TlcErrorCode.InvalidOnionVersion]: 0,
      [TlcErrorCode.InvalidOnionHmac]: 0,
      [TlcErrorCode.InvalidOnionKey]: 0,
      [TlcErrorCode.InvalidOnionPayload]: 0,
      [TlcErrorCode.InvalidOnionError]: 0,
      [TlcErrorCode.FinalIncorrectExpiryDelta]: 10,
      [TlcErrorCode.FinalIncorrectTlcAmount]: 5,
      [TlcErrorCode.HoldTlcTimeout]: 10,
      [TlcErrorCode.IncorrectTlcDirection]: 0,
    };
  }
}
