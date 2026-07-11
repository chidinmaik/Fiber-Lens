import { Router } from "express";
import paymentsRouter from "./payments";
import diagnosticsRouter from "./diagnostics";
import analyticsRouter from "./analytics";
import referenceRouter from "./reference";
import systemRouter from "./system";

const router = Router();

router.use("/payments", paymentsRouter);
router.use("/diagnostics", diagnosticsRouter);
router.use("/analytics", analyticsRouter);
router.use("/reference", referenceRouter);
router.use("/system", systemRouter);

export default router;
