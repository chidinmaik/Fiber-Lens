# Fiber Lens — Public REST API v1

> **Base URL:** `http://localhost:3001/api/v1`  
> **Version:** 1.0  
> **Content-Type:** `application/json`  
> **SDK:** `@fiber/lens-sdk` (future)

---

## Response Envelope

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

Errors:

```json
{
  "success": false,
  "error": "Human-readable message",
  "code": 404
}
```

---

## Payments

### `GET /payments`

List payments with pagination, filtering, and sorting.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `Created`, `Inflight`, `Success`, `Failed` |
| `category` | string | — | Filter: `LiquidityFailure`, `RoutingFailure`, etc. |
| `search` | string | — | Partial payment hash match |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "paymentHash": "0xa1b2...",
        "status": "Failed",
        "fee": "0x3e8",
        "failedError": "TemporaryChannelFailure",
        "failureCode": "TemporaryChannelFailure",
        "failureCategory": "LiquidityFailure",
        "createdAt": 1719000000000,
        "updatedAt": 1719000008000
      }
    ],
    "total": 20,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

### `GET /payments/:hash`

Get a single payment with its full investigation report.

**Response:** See [Investigation Report](#investigation-report).

### `POST /payments/analyze`

**The killer feature.** Analyze any payment by hash. Fetches from Fiber if not in local DB, runs diagnostics, persists, and returns.

**Request:** `{ "payment_hash": "0x..." }`

**Response:**

```json
{
  "success": true,
  "data": {
    "payment_hash": "0xa1b2...",
    "status": "Failed",
    "category": "Liquidity Failure",
    "severity": "Medium",
    "retryability": 92,
    "confidence": 94,
    "failed_hop": 3,
    "failing_node": "0x03a1b2...",
    "failing_channel": "0xc3d4...",
    "total_hops": 5,
    "summary": "Insufficient liquidity: TemporaryChannelFailure",
    "root_cause": "A node along the payment route did not have sufficient available liquidity...",
    "recommendations": [
      "Retry the payment later",
      "Rebalance your channels",
      "Open additional channels"
    ],
    "fiber_error": "TemporaryChannelFailure"
  }
}
```

### `GET /payments/:hash/diagnostics`

Get all diagnostics for a payment.

### `GET /payments/:hash/attempts`

Get all route attempts with full node-level detail.

### `GET /payments/:hash/timeline`

Get the reconstructed payment lifecycle timeline.

---

## Diagnostics

### `GET /diagnostics`

List diagnostics with pagination.

| Param | Type | Default |
|-------|------|---------|
| `page` | int | 1 |
| `limit` | int | 20 |
| `category` | string | — |
| `severity` | string | — |

### `GET /diagnostics/:id`

Get a single diagnostic by ID.

---

## Analytics

### `GET /analytics/overview`

```json
{
  "totalPayments": 20,
  "successfulPayments": 7,
  "failedPayments": 13,
  "inflightPayments": 0,
  "createdPayments": 0,
  "successRate": 35.0,
  "averageFee": 25000
}
```

### `GET /analytics/failures-by-category`

```json
{
  "categories": [
    { "name": "LiquidityFailure", "count": 5 },
    { "name": "RoutingFailure", "count": 3 }
  ],
  "severity": [
    { "name": "Medium", "count": 7 },
    { "name": "High", "count": 4 }
  ],
  "retryabilityBuckets": {
    "0-25": 3,
    "26-50": 2,
    "51-75": 3,
    "76-100": 5
  }
}
```

### `GET /analytics/recent-failures?limit=10`

Returns the most recent failure diagnostics.

---

## Reference Data

### `GET /reference/error-codes`

Returns all 25 Fiber TLC error codes with metadata:

```json
{
  "total": 25,
  "items": [
    {
      "code": "TemporaryChannelFailure",
      "label": "Temporary Channel Failure",
      "isPermanent": false,
      "isNodeError": false,
      "isChannelError": true,
      "category": "LiquidityFailure"
    }
  ]
}
```

### `GET /reference/categories`

Returns all 9 diagnostic categories with descriptions and default severity.

### `GET /reference/severity-levels`

Returns severity levels with descriptions and colors.

---

## System

### `GET /system/health`

Health check with uptime and version.

### `GET /system/status`

Full system status including Fiber RPC connectivity and DB stats.

```json
{
  "fiberRpcUrl": "http://localhost:8227",
  "fiberStatus": "disconnected",
  "syncEnabled": true,
  "syncIntervalMinutes": 5,
  "database": { "payments": 20, "diagnostics": 13 }
}
```

### `POST /system/sync`

Trigger a manual sync with Fiber.

```json
{
  "imported": 5,
  "skipped": 15,
  "timestamp": 1719000000000
}
```

---

## Investigation Report

The full response from `GET /payments/:hash`:

```json
{
  "payment": { ... },
  "diagnostic": {
    "category": "LiquidityFailure",
    "severity": "Medium",
    "retryability": 92,
    "confidence": 94,
    "summary": "...",
    "rootCause": "...",
    "recommendations": ["...", "..."]
  },
  "routeAttempts": [
    {
      "attemptIndex": 0,
      "hopCount": 4,
      "failingHop": 3,
      "failingNode": "0x03...",
      "failingChannel": "0xc3...",
      "status": "Failed",
      "failureReason": "TemporaryChannelFailure",
      "routeNodes": [
        { "pubkey": "0x02...", "channelOutpoint": "0xa1...", "amount": "0x5f5e100" }
      ]
    }
  ],
  "timeline": [
    { "timestamp": 1719000000000, "event": "Payment Created", "description": "..." },
    { "timestamp": 1719000008000, "event": "Payment Failed", "description": "..." }
  ],
  "rawFiberData": { ... }
}
```

---

## SDK Integration (Future)

```typescript
// npm install @fiber/lens-sdk
import { Lens } from "@fiber/lens-sdk";

const bb = new Lens({ rpcUrl: "http://localhost:3001" });

// Analyze a failed payment
const report = await bb.analyze("0xabc123...");
console.log(report.category);        // "Liquidity Failure"
console.log(report.retryability);    // 92
console.log(report.recommendations); // ["Retry payment", ...]

// List recent failures
const failures = await bb.payments.list({ status: "Failed", limit: 10 });

// Get analytics
const metrics = await bb.analytics.overview();
```

The dashboard itself is the first consumer of this exact API surface. Every endpoint the dashboard uses is publicly documented above.
