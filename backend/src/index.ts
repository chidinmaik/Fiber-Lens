import express from "express";
import cors from "cors";
import { config } from "./config";
import v1Router from "./routes/v1";
import { PaymentCollector } from "./services/PaymentCollector";
import { FiberClient } from "./services/FiberClient";
import { DiagnosticEngine } from "./diagnostics/DiagnosticEngine";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ─── Legacy API path forwarding ───
// Rewrite legacy paths to v1 equivalents before the v1 router handles them.
// This keeps old frontend clients working without duplicating route handlers.
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/payments") && !req.path.startsWith("/api/v1/")) {
    req.url = req.url.replace("/api/payments", "/api/v1/payments");
  } else if (req.path.startsWith("/api/diagnostics") && !req.path.startsWith("/api/v1/")) {
    req.url = req.url.replace("/api/diagnostics", "/api/v1/diagnostics");
  } else if (req.path.startsWith("/api/sync") && !req.path.startsWith("/api/v1/")) {
    req.url = req.url.replace("/api/sync", "/api/v1/system/sync");
  }
  next();
});

// ─── API v1 ───
app.use("/api/v1", v1Router);

// Health check (versionless)
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      version: "0.1.0",
      fiberRpcUrl: config.fiberRpcUrl,
      syncEnabled: config.syncEnabled,
      debugMode: config.debugMode,
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found", code: 404 });
});

// Start server
app.listen(config.port, () => {
  console.log(`[Fiber Lens] Backend running on port ${config.port}`);
  console.log(`[Fiber Lens] API v1: http://localhost:${config.port}/api/v1`);
  console.log(`[Fiber Lens] Fiber RPC: ${config.fiberRpcUrl}`);

  if (config.syncEnabled) {
    const fiberClient = new FiberClient(config.fiberRpcUrl);
    const diagnosticEngine = new DiagnosticEngine();
    const collector = new PaymentCollector(
      fiberClient,
      diagnosticEngine,
      config.syncIntervalMinutes
    );
    collector.startScheduledSync();
  }
});

export default app;
