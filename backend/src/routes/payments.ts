import { Router, Request, Response } from "express";
import prisma from "../db/prisma";
import { InvestigationReportGenerator } from "../diagnostics/InvestigationReportGenerator";
import { DiagnosticEngine } from "../diagnostics/DiagnosticEngine";
import { ApiResponse, PaginatedResponse, NormalizedPayment } from "../types";

const router = Router();
const diagnosticEngine = new DiagnosticEngine();
const reportGenerator = new InvestigationReportGenerator(diagnosticEngine);

// GET /api/payments — list all payments with pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.paymentHash = { contains: search };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          diagnostics: { take: 1, orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const items: NormalizedPayment[] = payments.map((p) => ({
      paymentHash: p.paymentHash,
      status: p.status as NormalizedPayment["status"],
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
        pageSize,
        hasMore: page * pageSize < total,
      },
    };

    res.json(response);
  } catch (err) {
    console.error("[PaymentsRoute] Error listing payments:", err);
    res.status(500).json({ success: false, error: "Failed to list payments" });
  }
});

// GET /api/payments/:hash — get investigation report
router.get("/:hash", async (req: Request, res: Response) => {
  try {
    const report = await reportGenerator.generateReport(String(req.params.hash));
    if (!report) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    console.error("[PaymentsRoute] Error generating report:", err);
    res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});

export default router;
