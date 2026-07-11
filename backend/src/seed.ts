// Seed script: populates the database with demo payment data
// Run: npx tsx src/seed.ts

import prisma from "./db/prisma";
import { DiagnosticEngine } from "./diagnostics/DiagnosticEngine";
import { PaymentStatus, FailureCategory, TlcErrorCode } from "./types";

const diagnosticEngine = new DiagnosticEngine();

const DEMO_WALLET_ADDRESS = "ckt1qrejnmlar3r452tcg57gvq8patctcgy8acync0hxfnyka35ywafvkqgjcxtaqyzlahkfsrke5zh7l6u3f28662lzqqthu46u";

const DEMO_PAYMENTS: Array<{
  hash: string;
  status: PaymentStatus;
  failedError: string | null;
  failureCode: TlcErrorCode;
  daysAgo: number;
}> = [
  { hash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", status: PaymentStatus.Failed, failedError: "TemporaryChannelFailure: insufficient liquidity in channel", failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 0 },
  { hash: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3", status: PaymentStatus.Failed, failedError: "FeeInsufficient: forwarding fee too low for hop", failureCode: TlcErrorCode.FeeInsufficient, daysAgo: 0 },
  { hash: "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 0 },
  { hash: "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5", status: PaymentStatus.Failed, failedError: "UnknownNextPeer: next peer in route not found", failureCode: TlcErrorCode.UnknownNextPeer, daysAgo: 1 },
  { hash: "0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 1 },
  { hash: "0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7", status: PaymentStatus.Failed, failedError: "ExpiryTooSoon: TLC expiry too close to current time", failureCode: TlcErrorCode.ExpiryTooSoon, daysAgo: 1 },
  { hash: "0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 2 },
  { hash: "0xb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9", status: PaymentStatus.Failed, failedError: "ChannelDisabled: channel has been administratively disabled", failureCode: TlcErrorCode.ChannelDisabled, daysAgo: 2 },
  { hash: "0xc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0", status: PaymentStatus.Failed, failedError: "PermanentChannelFailure: channel permanently failed", failureCode: TlcErrorCode.PermanentChannelFailure, daysAgo: 2 },
  { hash: "0xd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 3 },
  { hash: "0xe1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2", status: PaymentStatus.Failed, failedError: "TemporaryNodeFailure: node temporarily unavailable", failureCode: TlcErrorCode.TemporaryNodeFailure, daysAgo: 3 },
  { hash: "0xf2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 3 },
  { hash: "0xa3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4", status: PaymentStatus.Failed, failedError: "AmountBelowMinimum: amount below htlc_minimum_msat", failureCode: TlcErrorCode.AmountBelowMinimum, daysAgo: 4 },
  { hash: "0xb4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 4 },
  { hash: "0xc5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", status: PaymentStatus.Failed, failedError: "InvoiceExpired: the invoice has expired", failureCode: TlcErrorCode.InvoiceExpired, daysAgo: 4 },
  { hash: "0xd6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7", status: PaymentStatus.Failed, failedError: "PermanentNodeFailure: node has permanently failed, do not retry", failureCode: TlcErrorCode.PermanentNodeFailure, daysAgo: 5 },
  { hash: "0xe7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8", status: PaymentStatus.Success, failedError: null, failureCode: TlcErrorCode.TemporaryChannelFailure, daysAgo: 5 },
  { hash: "0xf8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9", status: PaymentStatus.Failed, failedError: "IncorrectOrUnknownPaymentDetails: payment hash unknown at final hop", failureCode: TlcErrorCode.IncorrectOrUnknownPaymentDetails, daysAgo: 5 },
  { hash: "0xa9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0", status: PaymentStatus.Failed, failedError: "HoldTlcTimeout: receiver held TLC but failed to resolve", failureCode: TlcErrorCode.HoldTlcTimeout, daysAgo: 6 },
  { hash: "0xb0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1", status: PaymentStatus.Failed, failedError: "InvalidOnionPayload: onion TLV payload malformed", failureCode: TlcErrorCode.InvalidOnionPayload, daysAgo: 6 },
];

async function seed() {
  console.log("[Seed] Clearing existing data...");
  await prisma.diagnostic.deleteMany();
  await prisma.routeAttempt.deleteMany();
  await prisma.payment.deleteMany();

  console.log(`[Seed] Creating ${DEMO_PAYMENTS.length} demo payments...`);

  for (const p of DEMO_PAYMENTS) {
    const now = Date.now();
    const created = now - p.daysAgo * 86400000;

    const payment = await prisma.payment.create({
      data: {
        paymentHash: p.hash,
        status: p.status,
        amount: "0x" + Math.floor(Math.random() * 100000000).toString(16),
        fee: "0x" + Math.floor(Math.random() * 50000).toString(16),
        createdAt: BigInt(created),
        updatedAt: BigInt(created + 8000),
        failedError: p.failedError,
        failureCode: p.status === PaymentStatus.Failed ? p.failureCode : null,
        failureCategory: null,
        ownerAddress: DEMO_WALLET_ADDRESS,
        rawFiberData: p.status === PaymentStatus.Failed ? JSON.stringify({
          payment_hash: p.hash,
          status: p.status,
          failed_error: p.failedError,
          fee: "0x3e8",
          created_at: "0x" + created.toString(16),
          last_updated_at: "0x" + (created + 8000).toString(16),
        }) : null,
      },
    });

    // Create diagnostic for failed payments
    if (p.status === PaymentStatus.Failed) {
      const diagnostic = diagnosticEngine.analyze({
        paymentHash: p.hash,
        status: p.status,
        amount: "0x0",
        fee: "0x0",
        createdAt: created,
        updatedAt: created + 8000,
        failedError: p.failedError,
        failureCode: p.failureCode,
        failureCategory: null,
        customRecords: null,
      });

      await prisma.diagnostic.create({
        data: {
          paymentHash: p.hash,
          category: diagnostic.category,
          severity: diagnostic.severity,
          retryability: diagnostic.retryability,
          confidence: diagnostic.confidence,
          summary: diagnostic.summary,
          rootCause: diagnostic.rootCause,
          recommendations: JSON.stringify(diagnostic.recommendations),
          createdAt: BigInt(created + 9000),
        },
      });

      // Create a route attempt for the failed payment
      await prisma.routeAttempt.create({
        data: {
          paymentHash: p.hash,
          attemptIndex: 0,
          hopCount: 4,
          failingHop: Math.floor(Math.random() * 4) + 1,
          failingNode: "0x03" + Math.random().toString(16).slice(2, 14),
          failingChannel: "0x" + Math.random().toString(16).slice(2, 18),
          status: "Failed",
          failureReason: p.failedError,
          routeNodesJson: JSON.stringify([
            { pubkey: "0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c", channelOutpoint: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c0000", amount: "0x5f5e100" },
            { pubkey: "0x02b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", channelOutpoint: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d0000", amount: "0x5f5e0f0" },
            { pubkey: "0x02c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e", channelOutpoint: "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e0000", amount: "0x5f5e0e0" },
            { pubkey: "0x02d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f", channelOutpoint: "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f0000", amount: "0x5f5e0d0" },
          ]),
        },
      });
    }

    // Update payment's failure category from diagnostic
    const diag = await prisma.diagnostic.findFirst({ where: { paymentHash: p.hash } });
    if (diag) {
      await prisma.payment.update({
        where: { paymentHash: p.hash },
        data: { failureCategory: diag.category },
      });
    }
  }

  const stats = await prisma.payment.groupBy({ by: ["status"], _count: true });
  console.log("[Seed] Done! Database now contains:");
  for (const s of stats) {
    console.log(`  ${s.status}: ${s._count}`);
  }
  console.log("[Seed] Diagnostics and route attempts also created for each failed payment.");
  console.log("[Seed] Ready to demo! Start the frontend and navigate to http://localhost:3000");
}

seed()
  .catch((e) => {
    console.error("[Seed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
