import {
  FiberPaymentResult,
  FiberListPaymentsResult,
  NormalizedPayment,
  PaymentStatus,
  TlcErrorCode,
} from "./types";

/**
 * Direct JSON-RPC client for Fiber Network nodes.
 *
 * Works in both browser and Node.js (18+). Zero dependencies.
 *
 * @example
 * ```ts
 * import { FiberClient } from "@fiber/lens-sdk";
 * const fiber = new FiberClient("http://localhost:8227");
 * const { payments } = await fiber.listPayments(50);
 * ```
 */
export class FiberClient {
  private rpcUrl: string;
  private requestId: number;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.requestId = 1;
  }

  // ─── Low-level RPC ───

  /**
   * Make a raw JSON-RPC call. You can use this for any Fiber RPC method,
   * including ones not yet wrapped by the SDK.
   */
  async call<T>(method: string, params: unknown): Promise<T> {
    // Fiber RPC expects params as an array [{...}], per the JSON-RPC 2.0 spec
    // and all official Fiber RPC examples.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: this.requestId++,
          method,
          params: [params],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Fiber RPC error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        result?: T;
        error?: { message: string };
      };
      if (data.error) {
        throw new Error(`Fiber RPC error: ${data.error.message}`);
      }

      return data.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Payment Methods ───

  /**
   * List payment history from the Fiber node.
   *
   * @param limit - Max payments to return (Fiber expects hex, SDK handles conversion)
   * @param after - Cursor for pagination
   * @param status - Filter by payment status
   */
  async listPayments(
    limit = 50,
    after?: string,
    status?: PaymentStatus
  ): Promise<FiberListPaymentsResult> {
    // Fiber RPC expects hex-encoded numeric values (e.g., "0x32" for 50)
    const params: Record<string, unknown> = {
      limit: `0x${limit.toString(16)}`,
    };
    if (after) params.after = after;
    if (status) params.status = status;
    return this.call<FiberListPaymentsResult>("list_payments", params);
  }

  /**
   * Get a single payment by its hash.
   */
  async getPayment(paymentHash: string): Promise<FiberPaymentResult> {
    return this.call<FiberPaymentResult>("get_payment", {
      payment_hash: paymentHash,
    });
  }

  /**
   * Get basic node information (version, pubkey, chain, channel/peer counts).
   */
  async nodeInfo(): Promise<{
    version: string;
    pubkey: string;
    chain_hash: string;
    channel_count: string;
    peers_count: string;
  }> {
    return this.call("node_info", {});
  }

  // ─── Normalization ───

  /**
   * Convert a raw Fiber RPC payment result into a normalized payment record.
   */
  normalizePayment(raw: FiberPaymentResult): NormalizedPayment {
    const failedError = raw.failed_error || null;
    const failureCode = failedError
      ? FiberClient.parseErrorCode(failedError)
      : null;

    return {
      paymentHash: raw.payment_hash,
      status: raw.status as PaymentStatus,
      amount: "0", // amount not exposed in GetPaymentCommandResult
      fee: raw.fee || "0x0",
      createdAt: parseInt(raw.created_at, 16) || Date.now(),
      updatedAt: parseInt(raw.last_updated_at, 16) || Date.now(),
      failedError,
      failureCode,
      failureCategory: null, // filled by DiagnosticEngine
      customRecords: raw.custom_records || null,
    };
  }

  /**
   * Normalize a batch of raw payment results.
   */
  normalizePaymentBatch(
    rawPayments: FiberPaymentResult[]
  ): NormalizedPayment[] {
    return rawPayments.map((p) => this.normalizePayment(p));
  }

  // ─── Error Code Parsing (static so DiagnosticEngine can reuse) ───

  /**
   * Parse a Fiber `failed_error` string into a canonical TlcErrorCode.
   * Returns `null` if the error doesn't match any known code.
   */
  static parseErrorCode(errorString: string): TlcErrorCode | null {
    const knownCodes = Object.values(TlcErrorCode) as string[];
    for (const code of knownCodes) {
      if (errorString.includes(code)) {
        return code as TlcErrorCode;
      }
    }
    // Fallback: substring matching for case-insensitive variants
    const lower = errorString.toLowerCase();
    if (lower.includes("temporarychannelfailure"))
      return TlcErrorCode.TemporaryChannelFailure;
    if (lower.includes("permanentchannelfailure"))
      return TlcErrorCode.PermanentChannelFailure;
    if (lower.includes("temporarynodefailure"))
      return TlcErrorCode.TemporaryNodeFailure;
    if (lower.includes("permanentnodefailure"))
      return TlcErrorCode.PermanentNodeFailure;
    if (lower.includes("feeinsufficient")) return TlcErrorCode.FeeInsufficient;
    if (lower.includes("amountbelowminimum"))
      return TlcErrorCode.AmountBelowMinimum;
    if (lower.includes("expirytoosoon")) return TlcErrorCode.ExpiryTooSoon;
    if (lower.includes("expirytoofar")) return TlcErrorCode.ExpiryTooFar;
    if (lower.includes("unknownnextpeer")) return TlcErrorCode.UnknownNextPeer;
    if (lower.includes("channeldisabled")) return TlcErrorCode.ChannelDisabled;
    if (lower.includes("invoiceexpired")) return TlcErrorCode.InvoiceExpired;
    if (lower.includes("invoicecancelled"))
      return TlcErrorCode.InvoiceCancelled;
    if (lower.includes("incorrectorunknownpaymentdetails"))
      return TlcErrorCode.IncorrectOrUnknownPaymentDetails;
    if (lower.includes("holdtlctimeout")) return TlcErrorCode.HoldTlcTimeout;
    if (lower.includes("incorrecttlcexpiry"))
      return TlcErrorCode.IncorrectTlcExpiry;
    if (lower.includes("invalidonion"))
      return TlcErrorCode.InvalidOnionPayload;
    return null;
  }
}
