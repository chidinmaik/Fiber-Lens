import { Router, Request, Response } from "express";
import prisma from "../db/prisma";
import { ApiResponse } from "../types";

const router = Router();

// GET /api/diagnostics/summary — aggregate diagnostics data
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [totalPayments, successfulPayments, failedPayments, diagnostics] =
      await Promise.all([
        prisma.payment.count(),
        prisma.payment.count({ where: { status: "Success" } }),
        prisma.payment.count({ where: { status: "Failed" } }),
        prisma.diagnostic.findMany({
          select: { category: true, severity: true, retryability: true },
        }),
      ]);

    const failureByCategory: Record<string, number> = {};
    const severityDistribution: Record<string, number> = {};
    const retryabilityBuckets: Record<string, number> = {
      "0-25": 0,
      "26-50": 0,
      "51-75": 0,
      "76-100": 0,
    };

    for (const d of diagnostics) {
      failureByCategory[d.category] = (failureByCategory[d.category] || 0) + 1;
      severityDistribution[d.severity] = (severityDistribution[d.severity] || 0) + 1;
      if (d.retryability <= 25) retryabilityBuckets["0-25"]++;
      else if (d.retryability <= 50) retryabilityBuckets["26-50"]++;
      else if (d.retryability <= 75) retryabilityBuckets["51-75"]++;
      else retryabilityBuckets["76-100"]++;
    }

    const successRate =
      totalPayments > 0
        ? Math.round((successfulPayments / totalPayments) * 10000) / 100
        : 0;

    const recentFailedDiagnostics = await prisma.diagnostic.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        payment: {
          select: { paymentHash: true, failedError: true, createdAt: true },
        },
      },
    });

    const response: ApiResponse<unknown> = {
      success: true,
      data: {
        metrics: {
          totalPayments,
          successfulPayments,
          failedPayments,
          successRate,
        },
        failureByCategory,
        severityDistribution,
        retryabilityBuckets,
        recentFailures: recentFailedDiagnostics.map((d) => ({
          paymentHash: d.paymentHash,
          category: d.category,
          severity: d.severity,
          retryability: d.retryability,
          summary: d.summary,
          failedError: d.payment.failedError,
          createdAt: Number(d.payment.createdAt),
        })),
      },
    };

    res.json(response);
  } catch (err) {
    console.error("[DiagnosticsRoute] Error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch diagnostics" });
  }
});

export default router;
