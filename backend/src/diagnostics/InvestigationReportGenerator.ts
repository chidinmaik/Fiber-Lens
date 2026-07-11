import {
  NormalizedPayment,
  DiagnosticReport,
  InvestigationReport,
  RouteAttempt,
  TimelineEvent,
  PaymentStatus,
} from "../types";
import { DiagnosticEngine } from "./DiagnosticEngine";
import prisma from "../db/prisma";

export class InvestigationReportGenerator {
  private diagnosticEngine: DiagnosticEngine;

  constructor(diagnosticEngine: DiagnosticEngine) {
    this.diagnosticEngine = diagnosticEngine;
  }

  async generateReport(paymentHash: string): Promise<InvestigationReport | null> {
    const payment = await prisma.payment.findUnique({
      where: { paymentHash },
      include: {
        diagnostics: { orderBy: { createdAt: "desc" }, take: 1 },
        routeAttempts: { orderBy: { attemptIndex: "asc" } },
      },
    });

    if (!payment) return null;

    const normalized: NormalizedPayment = {
      paymentHash: payment.paymentHash,
      status: payment.status as PaymentStatus,
      amount: payment.amount,
      fee: payment.fee,
      createdAt: Number(payment.createdAt),
      updatedAt: Number(payment.updatedAt),
      failedError: payment.failedError,
      failureCode: payment.failureCode as NormalizedPayment["failureCode"],
      failureCategory: payment.failureCategory as NormalizedPayment["failureCategory"],
      customRecords: null,
    };

    // Get or regenerate diagnostic
    let diagnostic: DiagnosticReport;
    if (payment.diagnostics.length > 0) {
      const d = payment.diagnostics[0];
      diagnostic = {
        id: d.id,
        paymentHash: d.paymentHash,
        category: d.category as DiagnosticReport["category"],
        severity: d.severity as DiagnosticReport["severity"],
        retryability: d.retryability,
        confidence: d.confidence,
        summary: d.summary,
        rootCause: d.rootCause,
        recommendations: JSON.parse(d.recommendations),
        createdAt: Number(d.createdAt),
      };
    } else {
      diagnostic = this.diagnosticEngine.analyze(normalized);
    }

    // Map route attempts
    const routeAttempts: RouteAttempt[] = payment.routeAttempts.map((ra) => ({
      id: ra.id,
      paymentHash: ra.paymentHash,
      attemptIndex: ra.attemptIndex,
      hopCount: ra.hopCount,
      failingHop: ra.failingHop,
      failingNode: ra.failingNode,
      failingChannel: ra.failingChannel,
      status: ra.status as RouteAttempt["status"],
      failureReason: ra.failureReason,
      routeNodes: JSON.parse(ra.routeNodesJson),
    }));

    // Build timeline
    const timeline = this.buildTimeline(payment.createdAt, payment.updatedAt, payment.status, routeAttempts);

    // Parse raw Fiber data
    let rawFiberData = null;
    try {
      if (payment.rawFiberData) {
        rawFiberData = JSON.parse(payment.rawFiberData);
      }
    } catch {
      // ignore parse errors
    }

    return {
      payment: normalized,
      diagnostic,
      routeAttempts,
      timeline,
      rawFiberData,
    };
  }

  private buildTimeline(
    createdAt: bigint,
    updatedAt: bigint,
    status: string,
    attempts: RouteAttempt[]
  ): TimelineEvent[] {
    const created = Number(createdAt);
    const updated = Number(updatedAt);
    const events: TimelineEvent[] = [];

    events.push({
      timestamp: created,
      event: "Payment Created",
      description: "Payment session was initialized",
    });

    for (const attempt of attempts) {
      events.push({
        timestamp: created + attempt.attemptIndex * 1000,
        event: attempt.status === "Success" ? "Payment Attempted (Success)" : "Payment Attempted (Failed)",
        description: `Attempt ${attempt.attemptIndex + 1}: ${attempt.status}${attempt.failureReason ? ` — ${attempt.failureReason}` : ""}${attempt.failingHop ? ` at hop ${attempt.failingHop} of ${attempt.hopCount}` : ""}`,
      });
    }

    if (status === "Failed") {
      events.push({
        timestamp: updated,
        event: "Payment Failed",
        description: "All attempts exhausted; payment terminated",
      });
    } else if (status === "Success") {
      events.push({
        timestamp: updated,
        event: "Payment Succeeded",
        description: "Payment completed successfully",
      });
    }

    events.push({
      timestamp: updated + 1,
      event: "Diagnostic Generated",
      description: "Failure analysis completed by Fiber Black Box",
    });

    return events;
  }
}
