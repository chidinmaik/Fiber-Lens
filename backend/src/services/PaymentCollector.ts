import { NormalizedPayment, PaymentStatus } from "../types";
import { FiberClient } from "./FiberClient";
import { DiagnosticEngine } from "../diagnostics/DiagnosticEngine";
import { config } from "../config";
import prisma from "../db/prisma";

export class PaymentCollector {
  private fiberClient: FiberClient;
  private diagnosticEngine: DiagnosticEngine;
  private syncIntervalMs: number;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    fiberClient: FiberClient,
    diagnosticEngine: DiagnosticEngine,
    syncIntervalMinutes: number
  ) {
    this.fiberClient = fiberClient;
    this.diagnosticEngine = diagnosticEngine;
    this.syncIntervalMs = syncIntervalMinutes * 60 * 1000;
  }

  // ─── Scheduled Sync ───

  startScheduledSync(): void {
    if (this.syncTimer) return;
    console.log(
      `[PaymentCollector] Starting scheduled sync every ${this.syncIntervalMs / 1000}s`
    );
    this.syncTimer = setInterval(() => {
      this.syncPayments().catch((err) =>
        console.error("[PaymentCollector] Sync error:", err)
      );
    }, this.syncIntervalMs);
    // Run immediately on start
    this.syncPayments().catch((err) =>
      console.error("[PaymentCollector] Initial sync error:", err)
    );
  }

  stopScheduledSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log("[PaymentCollector] Stopped scheduled sync");
    }
  }

  // ─── Manual Sync ───

  async syncPayments(): Promise<{ imported: number; skipped: number }> {
    console.log("[PaymentCollector] Syncing payments from Fiber...");
    let imported = 0;
    let skipped = 0;

    try {
      // Fetch recent payments with pagination
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await this.fiberClient.listPayments(50, cursor);
        const payments = result.payments || [];

        for (const raw of payments) {
          const normalized = this.fiberClient.normalizePayment(raw);
          const existing = await prisma.payment.findUnique({
            where: { paymentHash: normalized.paymentHash },
          });

          if (existing) {
            // Update if status changed
            if (existing.status !== normalized.status) {
              await prisma.payment.update({
                where: { paymentHash: normalized.paymentHash },
                data: {
                  status: normalized.status,
                  updatedAt: BigInt(normalized.updatedAt),
                  failedError: normalized.failedError,
                  failureCode: normalized.failureCode,
                },
              });
            }
            skipped++;
          } else {
            await this.importPayment(normalized, raw);
            imported++;
          }
        }

        cursor = result.last_cursor || undefined;
        hasMore = !!result.last_cursor && payments.length === 50;
      }

      console.log(
        `[PaymentCollector] Sync complete: ${imported} imported, ${skipped} skipped`
      );
    } catch (err) {
      console.error("[PaymentCollector] Sync failed:", err);
    }

    return { imported, skipped };
  }

  // ─── Single Payment Import ───

  async importPayment(
    normalized: NormalizedPayment,
    raw?: unknown
  ): Promise<void> {
    // Run diagnostics
    const diagnostic = this.diagnosticEngine.analyze(normalized);
    normalized.failureCategory = diagnostic.category;

    await prisma.payment.create({
      data: {
        paymentHash: normalized.paymentHash,
        status: normalized.status,
        amount: normalized.amount,
        fee: normalized.fee,
        createdAt: BigInt(normalized.createdAt),
        updatedAt: BigInt(normalized.updatedAt),
        failedError: normalized.failedError,
        failureCode: normalized.failureCode,
        failureCategory: normalized.failureCategory,
        ownerAddress: config.ownerAddress,
        rawFiberData: raw ? JSON.stringify(raw) : null,
      },
    });

    // Only create diagnostic for failed payments
    if (normalized.status === PaymentStatus.Failed) {
      await prisma.diagnostic.create({
        data: {
          paymentHash: normalized.paymentHash,
          category: diagnostic.category,
          severity: diagnostic.severity,
          retryability: diagnostic.retryability,
          confidence: diagnostic.confidence,
          summary: diagnostic.summary,
          rootCause: diagnostic.rootCause,
          recommendations: JSON.stringify(diagnostic.recommendations),
          createdAt: BigInt(diagnostic.createdAt || Date.now()),
        },
      });
    }
  }
}
