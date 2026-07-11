import { Router, Request, Response } from "express";
import { PaymentCollector } from "../services/PaymentCollector";
import { FiberClient } from "../services/FiberClient";
import { DiagnosticEngine } from "../diagnostics/DiagnosticEngine";
import { config } from "../config";
import { ApiResponse } from "../types";

const router = Router();

// POST /api/sync — manually trigger sync
router.post("/", async (_req: Request, res: Response) => {
  try {
    const fiberClient = new FiberClient(config.fiberRpcUrl);
    const diagnosticEngine = new DiagnosticEngine();
    const collector = new PaymentCollector(
      fiberClient,
      diagnosticEngine,
      config.syncIntervalMinutes
    );

    const result = await collector.syncPayments();

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (err) {
    console.error("[SyncRoute] Error:", err);
    res.status(500).json({ success: false, error: "Sync failed" });
  }
});

export default router;
