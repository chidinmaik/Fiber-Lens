import { Router, Request, Response } from "express";
import prisma from "../../db/prisma";
import { DiagnosticEngine } from "../../diagnostics/DiagnosticEngine";
import { InvestigationReportGenerator } from "../../diagnostics/InvestigationReportGenerator";
import { FiberClient } from "../../services/FiberClient";
import { PaymentCollector } from "../../services/PaymentCollector";
import { config } from "../../config";
import { ApiResponse, PaginatedResponse, NormalizedPayment, PaymentStatus } from "../../types";

const router = Router();
const diagnosticEngine = new DiagnosticEngine();
const reportGenerator = new InvestigationReportGenerator(diagnosticEngine);

// ─── Response Helpers ───
function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, meta: meta || {} };
}
function err(message: string, code = 500) {
  return { success: false, error: message, code };
}

// ─── GET /api/v1/payments ───
// List payments with pagination, filtering, and sorting.
// Query params:
//   page        (default 1)
//   limit       (default 20, max 100)
//   status      (Created | Inflight | Success | Failed)
//   category    (LiquidityFailure | RoutingFailure | Timeout | ...)
//   search      (partial payment hash match)
//   sort        (createdAt | updatedAt | fee, default createdAt)
//   order       (asc | desc, default desc)
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const sort = (req.query.sort as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";

    const address = req.query.address as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.failureCategory = category;
    if (search) where.paymentHash = { contains: search };
    if (address) where.ownerAddress = address;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const items: NormalizedPayment[] = payments.map((p) => ({
      paymentHash: p.paymentHash,
      status: p.status as PaymentStatus,
      amount: p.amount,
      fee: p.fee,
      createdAt: Number(p.createdAt),
      updatedAt: Number(p.updatedAt),
      failedError: p.failedError,
      failureCode: p.failureCode as NormalizedPayment["failureCode"],
      failureCategory: p.failureCategory as NormalizedPayment["failureCategory"],
      customRecords: null,
    }));

    const response: ApiResponse<PaginatedResponse<NormalizedPayment>> = {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize: limit,
        hasMore: page * limit < total,
      },
    };

    res.json(response);
  } catch (e) {
    console.error("[v1/payments] List error:", e);
    res.status(500).json(err("Failed to list payments"));
  }
});

// ─── GET /api/v1/payments/:hash ───
// Get a single payment with its diagnostic report.
router.get("/:hash", async (req: Request, res: Response) => {
  try {
    const report = await reportGenerator.generateReport(String(req.params.hash));
    if (!report) {
      return res.status(404).json(err("Payment not found", 404));
    }
    res.json(ok(report));
  } catch (e) {
    console.error("[v1/payments] Get error:", e);
    res.status(500).json(err("Failed to get payment"));
  }
});

// ─── GET /api/v1/payments/:hash/diagnostics ───
// Get all diagnostics for a payment (most recent first).
router.get("/:hash/diagnostics", async (req: Request, res: Response) => {
  try {
    const diagnostics = await prisma.diagnostic.findMany({
      where: { paymentHash: String(req.params.hash) },
      orderBy: { createdAt: "desc" },
    });
    const items = diagnostics.map((d) => ({
      ...d,
      recommendations: JSON.parse(d.recommendations),
      createdAt: Number(d.createdAt),
    }));
    res.json(ok(items));
  } catch (e) {
    console.error("[v1/payments] Diagnostics error:", e);
    res.status(500).json(err("Failed to get diagnostics"));
  }
});

// ─── GET /api/v1/payments/:hash/attempts ───
// Get all route attempts for a payment.
router.get("/:hash/attempts", async (req: Request, res: Response) => {
  try {
    const attempts = await prisma.routeAttempt.findMany({
      where: { paymentHash: String(req.params.hash) },
      orderBy: { attemptIndex: "asc" },
    });
    const items = attempts.map((a) => ({
      ...a,
      routeNodes: JSON.parse(a.routeNodesJson),
    }));
    res.json(ok(items));
  } catch (e) {
    console.error("[v1/payments] Attempts error:", e);
    res.status(500).json(err("Failed to get attempts"));
  }
});

// ─── GET /api/v1/payments/:hash/timeline ───
// Get timeline events for a payment.
router.get("/:hash/timeline", async (req: Request, res: Response) => {
  try {
    const report = await reportGenerator.generateReport(String(req.params.hash));
    if (!report) {
      return res.status(404).json(err("Payment not found", 404));
    }
    res.json(ok(report.timeline));
  } catch (e) {
    console.error("[v1/payments] Timeline error:", e);
    res.status(500).json(err("Failed to get timeline"));
  }
});

// ─── POST /api/v1/payments/analyze ───
// Public diagnostics endpoint — the "killer feature".
// Any wallet, merchant, or node operator can call this.
//
// Request:  { "payment_hash": "0x..." }
// Response: { status, category, severity, retryability, confidence,
//             failed_hop, failing_node, summary, root_cause, recommendations }
//
// If the payment isn't in the local DB, it fetches from Fiber first,
// runs diagnostics, persists, and returns the result.
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { payment_hash } = req.body;
    if (!payment_hash || typeof payment_hash !== "string") {
      return res.status(400).json(err("payment_hash is required", 400));
    }

    // Check if we already have this payment analyzed
    let report = await reportGenerator.generateReport(payment_hash);
    
    if (!report) {
      // Fetch from Fiber, analyze, persist
      const fiberClient = new FiberClient(config.fiberRpcUrl);
      const collector = new PaymentCollector(fiberClient, diagnosticEngine, config.syncIntervalMinutes);
      
      let rawPayment;
      try {
        rawPayment = await fiberClient.getPayment(payment_hash);
      } catch {
        return res.status(404).json(err("Payment not found on Fiber node", 404));
      }

      const normalized = fiberClient.normalizePayment(rawPayment);
      await collector.importPayment(normalized, rawPayment);
      report = await reportGenerator.generateReport(payment_hash);
      
      if (!report) {
        return res.status(500).json(err("Failed to analyze payment"));
      }
    }

    // Return a clean, integration-friendly response
    const { diagnostic, routeAttempts } = report;
    const primaryAttempt = routeAttempts.find(a => a.status === "Failed") || routeAttempts[0];

    res.json(ok({
      payment_hash: report.payment.paymentHash,
      status: report.payment.status,
      category: diagnostic.category,
      severity: diagnostic.severity,
      retryability: diagnostic.retryability,
      confidence: diagnostic.confidence,
      failed_hop: primaryAttempt?.failingHop ?? null,
      failing_node: primaryAttempt?.failingNode ?? null,
      failing_channel: primaryAttempt?.failingChannel ?? null,
      total_hops: primaryAttempt?.hopCount ?? null,
      summary: diagnostic.summary,
      root_cause: diagnostic.rootCause,
      recommendations: diagnostic.recommendations,
      fiber_error: report.payment.failedError,
    }));
  } catch (e) {
    console.error("[v1/payments] Analyze error:", e);
    res.status(500).json(err("Analysis failed"));
  }
});

export default router;
