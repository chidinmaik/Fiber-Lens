# Fiber Lens

**Payment observability and diagnostics for the Fiber Network.**

Fiber Lens connects to a running Fiber node, captures payment history, and when payments fail, it explains why — in plain English, with specific recommendations on how to fix it.

---

## What It Does

- Connects to any Fiber node via JSON-RPC (no Fiber code changes needed)
- Syncs payment history every 5 minutes
- Classifies failed payments against Fiber's 25 canonical error codes
- Generates diagnostic reports with severity, retryability, and confidence scores
- Shows route visualization with the failing hop highlighted
- Provides actionable recovery recommendations
- Exposes everything through a REST API and a zero-dependency SDK

---

## Quick Start

### Prerequisites
- Node.js 18+
- Windows (for the pre-built Fiber node binary)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Fiber Node (for real data)
```bash
cd fiber-node
set FIBER_SECRET_KEY_PASSWORD=demo123
fnn.exe -c config.yml -d .
```
The node starts on `http://localhost:8227`.

### 3. Start the Backend
```bash
cd backend
npx prisma db push          # Create SQLite tables
npx tsx src/seed.ts         # Seed 20 demo payments
npm run dev                 # Starts on :3001
```

### 4. Start the Frontend
```bash
cd frontend
npm run dev                 # Starts on :3000
```

Open `http://localhost:3000` in your browser.

### Demo Mode (No Fiber Node Required)
If you don't have a Fiber node running, seed the database with demo data:
```bash
cd backend
npx tsx src/seed.ts
```
This creates 20 realistic payments (successes and failures) with full diagnostic reports.

---

## Architecture

```
Fiber Node (RPC :8227)
    ↓
Payment Collector (5-min sync)
    ↓
Diagnostics Engine (classifies failures)
    ↓
SQLite Database (Prisma ORM)
    ↓
Express API (:3001 /api/v1)
    ↓
Next.js Dashboard (:3000)
```

The project is an npm monorepo with four packages:
- **`packages/sdk`** — `@fiber/lens-sdk`: FiberClient, DiagnosticEngine, Lens API client
- **`backend`** — Express API server with Prisma + PaymentCollector
- **`frontend`** — Next.js dashboard with Tailwind + Shadcn UI
- **`shared`** — Common TypeScript types

---

## SDK Usage

Install in any project:
```bash
npm install @fiber/lens-sdk
```

### Analyze a Payment
```ts
import { Lens } from "@fiber/lens-sdk";
const lens = new Lens({ baseUrl: "http://localhost:3001" });
const report = await lens.analyze("0xabc123...");
// → { category, severity, retryability, rootCause, recommendations }
```

### Direct Fiber RPC
```ts
import { FiberClient } from "@fiber/lens-sdk";
const fiber = new FiberClient("http://localhost:8227");
const { payments } = await fiber.listPayments(50);
```

### Standalone Diagnostics (No Server)
```ts
import { DiagnosticEngine } from "@fiber/lens-sdk";
const engine = new DiagnosticEngine();
const report = engine.analyze(payment); // pure logic, zero dependencies
```

---

## API Endpoints

| Endpoint | Description |
|----------|------------|
| `GET /api/v1/payments` | List payments (paginated, filterable by status/category/address) |
| `GET /api/v1/payments/:hash` | Full investigation report (diagnostic + route + timeline) |
| `POST /api/v1/payments/analyze` | Analyze any payment by hash |
| `GET /api/v1/analytics/overview` | Dashboard metrics (totals, success rate) |
| `GET /api/v1/system/status` | Fiber connectivity, DB stats, sync config |
| `POST /api/v1/system/sync` | Manual sync trigger |

Full API docs: [`API.md`](API.md)

---

## Wallet Connection

Fiber Lens supports real CKB wallet connections via CCC (Common Chains Connector):
- JoyID
- MetaMask
- OKX Wallet
- Neuron
- UTXO Global
- Unisat, Xverse, Rei, Nostr

A demo wallet (pre-configured testnet address) is also available for instant demos.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite via Prisma ORM |
| SDK | TypeScript, zero dependencies |
| Fiber Node | fnn.exe v0.8.1 (testnet) |

---

## Project Structure

```
fiber-lens/
├── packages/sdk/       # @fiber/lens-sdk
├── backend/            # Express API + PaymentCollector
├── frontend/           # Next.js dashboard
├── shared/             # Shared types
└── fiber-node/         # Pre-built Fiber testnet node
```

---

## License

MIT
