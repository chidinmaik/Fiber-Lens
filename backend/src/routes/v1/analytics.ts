import { Router, Request, Response } from "express";
import prisma from "../../db/prisma";

const router = Router();

function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, meta: meta || {} };
}
function err(message: string, code = 500) {
  return { success: false, error: message, code };
}

// ─── GET /api/v1/analytics/overview ───
// High-level dashboard metrics.
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const [total, successful, failed, inflight, created] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "Success" } }),
      prisma.payment.count({ where: { status: "Failed" } }),
      prisma.payment.count({ where: { status: "Inflight" } }),
      prisma.payment.count({ where: { status: "Created" } }),
    ]);

    const successRate = total > 0 ? Math.round((successful / total) * 10000) / 100 : 0;

    // Average fee (parse hex)
    const payments = await prisma.payment.findMany({ select: { fee: true }, take: 1000 });
    const fees = payments.map((p) => parseInt(p.fee, 16) || 0);
    const avgFee = fees.length > 0 ? fees.reduce((a, b) => a + b, 0) / fees.length : 0;

    res.json(ok({
      totalPayments: total,
      successfulPayments: successful,
      failedPayments: failed,
      inflightPayments: inflight,
      createdPayments: created,
      successRate,
      averageFee: avgFee,
    }));
  } catch (e) {
    console.error("[v1/analytics] Overview error:", e);
    res.status(500).json(err("Failed to get analytics overview"));
  }
});

// ─── GET /api/v1/analytics/failures-by-category ───
router.get("/failures-by-category", async (_req: Request, res: Response) => {
  try {
    const diagnostics = await prisma.diagnostic.findMany({
      select: { category: true, severity: true, retryability: true },
    });

    const categoryCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    const retryabilityBuckets = { "0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0 };

    for (const d of diagnostics) {
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
      severityCounts[d.severity] = (severityCounts[d.severity] || 0) + 1;
      if (d.retryability <= 25) retryabilityBuckets["0-25"]++;
      else if (d.retryability <= 50) retryabilityBuckets["26-50"]++;
      else if (d.retryability <= 75) retryabilityBuckets["51-75"]++;
      else retryabilityBuckets["76-100"]++;
    }

    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    const sortedSeverity = Object.entries(severityCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    res.json(ok({
      categories: sortedCategories,
      severity: sortedSeverity,
      retryabilityBuckets,
      totalDiagnostics: diagnostics.length,
    }));
  } catch (e) {
    console.error("[v1/analytics] Failures error:", e);
    res.status(500).json(err("Failed to get failure analytics"));
  }
});

// ─── GET /api/v1/analytics/recent-failures ───
router.get("/recent-failures", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const diagnostics = await prisma.diagnostic.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { payment: { select: { paymentHash: true, failedError: true, createdAt: true, status: true } } },
    });
    const items = diagnostics.map((d) => ({
      diagnosticId: d.id,
      paymentHash: d.paymentHash,
      category: d.category,
      severity: d.severity,
      retryability: d.retryability,
      confidence: d.confidence,
      summary: d.summary,
      failedError: d.payment.failedError,
      paymentCreatedAt: Number(d.payment.createdAt),
      diagnosticCreatedAt: Number(d.createdAt),
    }));
    res.json(ok(items));
  } catch (e) {
    console.error("[v1/analytics] Recent failures error:", e);
    res.status(500).json(err("Failed to get recent failures"));
  }
});

export default router;
