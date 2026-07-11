import { Router, Request, Response } from "express";
import prisma from "../../db/prisma";

const router = Router();

function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, meta: meta || {} };
}
function err(message: string, code = 500) {
  return { success: false, error: message, code };
}

// ─── GET /api/v1/diagnostics ───
// List diagnostics with pagination and filtering.
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const category = req.query.category as string | undefined;
    const severity = req.query.severity as string | undefined;
    const sort = (req.query.sort as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (severity) where.severity = severity;

    const [diagnostics, total] = await Promise.all([
      prisma.diagnostic.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: { payment: { select: { paymentHash: true, status: true } } },
      }),
      prisma.diagnostic.count({ where }),
    ]);

    const items = diagnostics.map((d) => ({
      ...d,
      recommendations: JSON.parse(d.recommendations),
      createdAt: Number(d.createdAt),
    }));

    res.json(ok({ items, total, page, pageSize: limit, hasMore: page * limit < total }));
  } catch (e) {
    console.error("[v1/diagnostics] List error:", e);
    res.status(500).json(err("Failed to list diagnostics"));
  }
});

// ─── GET /api/v1/diagnostics/:id ───
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const d = await prisma.diagnostic.findUnique({
      where: { id: String(req.params.id) },
      include: { payment: { select: { paymentHash: true, status: true, failedError: true } } },
    });
    if (!d) return res.status(404).json(err("Diagnostic not found", 404));
    res.json(ok({ ...d, recommendations: JSON.parse(d.recommendations), createdAt: Number(d.createdAt) }));
  } catch (e) {
    console.error("[v1/diagnostics] Get error:", e);
    res.status(500).json(err("Failed to get diagnostic"));
  }
});

export default router;
