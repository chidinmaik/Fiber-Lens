import { Router, Request, Response } from "express";
import { config } from "../../config";
import { PaymentCollector } from "../../services/PaymentCollector";
import { FiberClient } from "../../services/FiberClient";
import { DiagnosticEngine } from "../../diagnostics/DiagnosticEngine";
import prisma from "../../db/prisma";

const router = Router();

function ok<T>(data: T) {
  return { success: true, data };
}
function err(message: string, code = 500) {
  return { success: false, error: message, code };
}

// ─── In-memory cache for system status ───
// Avoids pinging the Fiber node on every page load.
let cachedStatus: {
  data: Record<string, unknown>;
  timestamp: number;
} | null = null;
const STATUS_CACHE_TTL_MS = 10_000; // 10 seconds

// ─── GET /api/v1/system/health ───
router.get("/health", (_req: Request, res: Response) => {
  res.json(ok({
    status: "ok",
    version: "0.1.0",
    uptime: process.uptime(),
    timestamp: Date.now(),
  }));
});

// ─── GET /api/v1/system/status ───
// Full system status including Fiber connection and DB stats.
// Uses a 10-second in-memory cache to avoid hammering the Fiber node.
router.get("/status", async (_req: Request, res: Response) => {
  try {
    // Return cached result if still fresh
    if (cachedStatus && Date.now() - cachedStatus.timestamp < STATUS_CACHE_TTL_MS) {
      return res.json(ok(cachedStatus.data));
    }

    // Check Fiber connectivity — use nodeInfo() which is lighter than listPayments()
    let fiberStatus: "connected" | "disconnected" | "unknown" = "unknown";
    try {
      const client = new FiberClient(config.fiberRpcUrl);
      await client.nodeInfo(); // lightweight call, 5s timeout built into FiberClient
      fiberStatus = "connected";
    } catch {
      fiberStatus = "disconnected";
    }

    const [paymentCount, diagnosticCount] = await Promise.all([
      prisma.payment.count(),
      prisma.diagnostic.count(),
    ]);

    const data = {
      fiberRpcUrl: config.fiberRpcUrl,
      fiberStatus,
      syncEnabled: config.syncEnabled,
      syncIntervalMinutes: config.syncIntervalMinutes,
      debugMode: config.debugMode,
      database: {
        payments: paymentCount,
        diagnostics: diagnosticCount,
      },
      demoDataAvailable: paymentCount > 0 && fiberStatus === "disconnected",
    };

    // Update cache
    cachedStatus = { data, timestamp: Date.now() };

    res.json(ok(data));
  } catch (e) {
    console.error("[v1/system] Status error:", e);
    res.status(500).json(err("Failed to get system status"));
  }
});

// ─── POST /api/v1/system/test-connection ───
// Test connectivity to a Fiber RPC endpoint.
router.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const { rpcUrl } = req.body;
    if (!rpcUrl || typeof rpcUrl !== "string") {
      return res.status(400).json(err("rpcUrl is required", 400));
    }
    const client = new FiberClient(rpcUrl);
    await client.nodeInfo(); // lighter than listPayments()
    res.json(ok({ connected: true, rpcUrl }));
  } catch (e: any) {
    res.json(ok({ connected: false, rpcUrl: req.body.rpcUrl, error: e?.message || "Connection failed" }));
  }
});

// ─── POST /api/v1/system/sync ───
// Trigger a manual sync with Fiber.
router.post("/sync", async (_req: Request, res: Response) => {
  try {
    const fiberClient = new FiberClient(config.fiberRpcUrl);
    const diagnosticEngine = new DiagnosticEngine();
    const collector = new PaymentCollector(fiberClient, diagnosticEngine, config.syncIntervalMinutes);

    const result = await collector.syncPayments();
    // Invalidate status cache after sync
    cachedStatus = null;

    res.json(ok({
      imported: result.imported,
      skipped: result.skipped,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.error("[v1/system] Sync error:", e);
    res.status(500).json(err("Sync failed"));
  }
});

// ─── POST /api/v1/system/clear-cache ───
// Manually clear the status cache (useful after config changes).
router.post("/clear-cache", (_req: Request, res: Response) => {
  cachedStatus = null;
  res.json(ok({ cleared: true }));
});

export default router;
