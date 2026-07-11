# Route Visibility in Fiber — Investigation Report

> **Generated:** 2026-06-24  
> **Fiber branch:** `develop`  
> **Purpose:** Determine whether Fiber Lens can show the exact route used, the failing hop, retry attempts, and route evolution across retries.

---

## Table of Contents

1. [Key Data Structures](#key-data-structures)
2. [What Is Persisted](#what-is-persisted)
3. [What Is Exposed via RPC](#what-is-exposed-via-rpc)
4. [What Lens CAN Show (Today)](#what-black-box-can-show-today)
5. [What Lens CANNOT Show (Today)](#what-black-box-cannot-show-today)
6. [Gap Analysis](#gap-analysis)
7. [Recommended Fiber Enhancements](#recommended-fiber-enhancements)

---

## Key Data Structures

### [`SessionRoute`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:493-545)

The route as stored on an attempt:

```rust
pub struct SessionRoute {
    pub nodes: Vec<SessionRouteNode>,  // ordered list from source to target
}

pub struct SessionRouteNode {
    pub pubkey: Pubkey,                     // node's public key
    pub amount: u128,                       // amount forwarded through this hop
    pub channel_outpoint: OutPoint,         // channel used at this hop
}
```

- Created from [`PaymentHopData`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:548-559) via [`SessionRoute::new()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:505-527)
- Source node is at `nodes[0]`, target is at `nodes[last]`
- Each node carries the **channel outpoint** for that hop and the **amount** forwarded
- **Fully serialized** (implements `Serialize` / `Deserialize`)

### [`RouterHop`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:452-469)

The explicit routing input type:

```rust
pub struct RouterHop {
    pub target: Pubkey,
    pub channel_outpoint: OutPoint,
    pub amount_received: u128,
    pub incoming_tlc_expiry: u64,
}
```

- Used as **input** to `send_payment_with_router` and `build_router`
- Stored in [`SendPaymentData.router: Vec<RouterHop>`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:873)
- **NOT persisted independently** — consumed during route building and converted into `SessionRoute` / `PaymentHopData`
- The `SendPaymentData` IS stored as part of `PaymentSession.request`

### [`PaymentSession`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:887-902)

```rust
pub struct PaymentSession {
    pub request: SendPaymentData,           // original payment parameters
    pub last_error: Option<String>,          // aggregated error string
    pub last_error_code: Option<TlcErrorCode>, // aggregated error code
    pub try_limit: u32,
    pub status: PaymentStatus,
    pub created_at: u64,
    pub last_updated_at: u64,
    #[serde(skip)]
    pub cached_attempts: Vec<Attempt>,       // runtime only, reloaded from store
}
```

- **`cached_attempts` is `#[serde(skip)]`** — NOT serialized with the session
- When deserialized from store, [`init_attempts()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:599-602) reloads attempts via [`store.get_attempts()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\store\store_impl\mod.rs:1187-1193)
- `last_error` and `last_error_code` are aggregates — not per-attempt

### [`Attempt`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:650-664)

```rust
pub struct Attempt {
    pub id: u64,
    pub try_limit: u32,
    pub tried_times: u32,
    pub hash: Hash256,
    pub status: AttemptStatus,              // Created | Inflight | Retrying | Success | Failed
    pub payment_hash: Hash256,
    pub route: SessionRoute,                // ← FULL ROUTE with node pubkeys + channel outpoints
    pub route_hops: Vec<PaymentHopData>,     // ← DETAILED hop data (amount, expiry, funding_tx)
    pub session_key: [u8; 32],
    pub preimage: Option<Hash256>,
    pub created_at: u64,
    pub last_updated_at: u64,
    pub last_error: Option<String>,          // ← per-attempt error (string only)
}
```

- **Fully serialized and persisted** via [`insert_attempt()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\store\store_impl\mod.rs:1163-1185)
- Each attempt stores its **own route** (`route: SessionRoute`) and **own error** (`last_error`)
- For **MPP payments**: multiple parallel attempts, each with its own route
- For **retries**: each retry creates a new attempt or updates an existing one via [`update_route()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:709-714)
- Stored in a key-value store under prefix `ATTEMPT_PREFIX | payment_hash | attempt_id`

### [`DecodedTlcErr`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:37-41)

```rust
pub struct DecodedTlcErr {
    pub error: TlcErr,      // structured error with TlcErrorCode + optional TlcErrData
    pub hop_index: usize,   // ← ZERO-BASED index identifying the failing hop
}
```

- **Transient only** — decoded in [`handle_remove_tlc_event()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1813-1824)
- `hop_index` consumed by history for graph penalization, then discarded
- `TlcErr` contains structured data (`TlcErrorCode`, `node_id`, `channel_outpoint`) but is **never persisted** on `Attempt`

---

## What Is Persisted

| Data | Stored On | Persisted? | Reloadable? | File:Line |
|------|-----------|------------|-------------|-----------|
| Payment parameters (`SendPaymentData`) | `PaymentSession.request` | ✅ Yes | ✅ Yes | [`payment.rs:889`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:889) |
| Session-level error string | `PaymentSession.last_error` | ✅ Yes | ✅ Yes | [`payment.rs:890`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:890) |
| Session-level error code | `PaymentSession.last_error_code` | ✅ Yes | ✅ Yes | [`payment.rs:892`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:892) |
| Payment status | `PaymentSession.status` | ✅ Yes | ✅ Yes | [`payment.rs:896`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:896) |
| **Each attempt's full route** | `Attempt.route` / `Attempt.route_hops` | ✅ **Yes** | ✅ **Yes** | [`payment.rs:657-658`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:657) |
| **Each attempt's status** | `Attempt.status` | ✅ Yes | ✅ Yes | [`payment.rs:655`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:655) |
| **Each attempt's error** | `Attempt.last_error` | ✅ Yes | ✅ Yes | [`payment.rs:663`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:663) |
| **Each attempt's timestamps** | `Attempt.created_at` / `last_updated_at` | ✅ Yes | ✅ Yes | [`payment.rs:661-662`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:661) |
| **Each attempt's try count** | `Attempt.tried_times` | ✅ Yes | ✅ Yes | [`payment.rs:653`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:653) |
| Per-attempt route hop details | `PaymentHopData` (amount, expiry, funding_tx_hash, next_hop) | ✅ Yes | ✅ Yes | [`payment.rs:548-559`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:548) |
| Failing hop index (`hop_index`) | *(none)* | ❌ **No** | ❌ No | Transient in [`onion.rs:40`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:40) |
| Failing node identity (`node_id`) | *(none)* | ❌ **No** | ❌ No | Transient in [`payment.rs:171,175`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:171) |
| Failing channel (`channel_outpoint`) | *(none)* | ❌ **No** | ❌ No | Transient in [`payment.rs:167`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:167) |
| Numeric TLC error code | `PaymentSession.last_error_code` (but not per-attempt) | ✅ Session-level only | ✅ | [`payment.rs:892`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:892) |

### Store API

The [`NetworkGraphStateStore`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:3023-3057) trait provides:

| Method | Returns | Use |
|--------|---------|-----|
| `get_payment_session(hash)` | `Option<PaymentSession>` (with reloaded attempts) | Single payment lookup |
| `get_payment_sessions_with_limit(limit, after, status)` | `Vec<PaymentSession>` | Paginated listing |
| `get_attempts(payment_hash)` | `Vec<Attempt>` | **All attempts for a payment** |
| `get_attempt(payment_hash, id)` | `Option<Attempt>` | Single attempt lookup |
| `get_pending_attempts_by_channel_outpoint(outpoint)` | `Vec<Attempt>` | Attempts using a specific channel |
| `delete_attempts(payment_hash)` | — | Cleanup on retry |
| `clear_attempts_channel_index(payment_hash)` | — | Cleanup on final |

**Critically: `get_attempts()` exists and returns fully structured `Attempt` records with routes — but it is NOT exposed through any RPC method.**

---

## What Is Exposed via RPC

### [`GetPaymentCommandResult`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-json-types\src\payment.rs:63-94)

```json
{
  "payment_hash": "0xabc...",
  "status": "Failed",                       // Created | Inflight | Success | Failed
  "created_at": "0x...",                    // ms since UNIX epoch
  "last_updated_at": "0x...",
  "failed_error": "TemporaryChannelFailure", // ← opaque string, aggregated
  "fee": "0x...",
  "custom_records": { ... },
  "routers": [ ... ]                         // ← ONLY in debug builds!
}
```

### The Conversion: What Gets Lost

In [`From<PaymentSession> for SendPaymentResponse`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:610-646):

```rust
// Lines 614-626: The attempts ARE iterated, but only to compute aggregates
let mut all_attempts = session
    .attempts()
    .map(|a| {
        (a.id, a.status, a.last_error.clone(), a.tried_times, a.route.receiver_amount())
    })
    .collect::<Vec<_>>();
all_attempts.sort_by_key(|a| a.0);
// ← This data is collected, sorted, then DROPPED — never included in the response!
```

Only the **aggregated** `session.last_error` (not per-attempt errors) and `session.status` make it to the response. The per-attempt breakdown of routes, errors, and timestamps is **computed but discarded**.

The `routers` field (line 642-643) only includes routes from **non-failed** attempts, and only in debug builds:

```rust
#[cfg(any(debug_assertions, test, feature = "bench"))]
routers: attempts.iter().map(|a| a.route.clone()).collect::<Vec<_>>(),
```

### RPC Methods Summary

| Method | Route Visibility | Attempt Visibility | Error Granularity |
|--------|-----------------|--------------------|--------------------|
| `send_payment` | ❌ (debug only: non-failed routes) | ❌ | Session-level string only |
| `get_payment` | ❌ (debug only: non-failed routes) | ❌ | Session-level string only |
| `list_payments` | ❌ (debug only) | ❌ | Session-level string only |
| `send_payment_with_router` | ❌ (debug only) | ❌ | Session-level string only |

### CLI

The `fiber-cli` tool in [`crates/fiber-cli/`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-cli) consumes the same RPC methods and has no additional visibility beyond what the JSON-RPC API exposes.

---

## What Lens CAN Show (Today)

### ✅ With RPC Only (production builds)

| Capability | How |
|------------|-----|
| Payment status (Created/Inflight/Success/Failed) | `GetPaymentCommandResult.status` |
| Aggregated failure reason (one string) | `GetPaymentCommandResult.failed_error` |
| Fee paid | `GetPaymentCommandResult.fee` |
| Payment timestamps (created, updated) | `created_at`, `last_updated_at` |
| Custom records | `custom_records` |
| Heuristic failure classification | Parse the `failed_error` string |

### ✅ If Accessing the Store Directly (requires code changes)

| Capability | How |
|------------|-----|
| **Exact route used (per attempt)** | `store.get_attempts(hash)` → each `Attempt.route` has full `SessionRoute` |
| **All retry attempts with their routes** | `store.get_attempts(hash)` returns all attempts |
| **Per-attempt error strings** | `Attempt.last_error` on each stored attempt |
| **Per-attempt status and timestamps** | `Attempt.status`, `created_at`, `last_updated_at` |
| **Try counts per attempt** | `Attempt.tried_times` |
| **Route evolution across retries** | Compare `route` across attempts sorted by `id` or `created_at` |
| **Which channels were tried** | `Attempt.route.nodes[].channel_outpoint` |
| **Amounts per hop** | `Attempt.route.nodes[].amount` |
| **Hop-level detail (expiry, funding_tx)** | `Attempt.route_hops` |

---

## What Lens CANNOT Show (Today)

| Gap | Root Cause | Severity |
|-----|-----------|----------|
| **Which specific hop failed** | `DecodedTlcErr.hop_index` not persisted | 🔴 Critical |
| **Which specific node caused the failure** | `TlcErrData::NodeFailed { node_id }` not persisted | 🔴 Critical |
| **Which specific channel caused the failure** | `TlcErrData::ChannelFailed { channel_outpoint, ... }` not persisted | 🔴 Critical |
| **Numeric error code per attempt** | Only stored at session level (`last_error_code`), not per-attempt | 🟡 Medium |
| **Per-attempt breakdown via RPC** | Conversion in `SendPaymentResponse` discards attempt-level data | 🟡 Medium |
| **Route visualization via RPC** | `routers` field is `#[cfg(debug_assertions)]` only | 🟡 Medium |
| **Trampoline inner failures** | `TrampolineFailed { inner_error_packet }` not decoded/persisted beyond trampoline node | 🟠 Low |

---

## Gap Analysis

### Data Flow: Where Route + Failure Data Gets Lost

```
┌─────────────────────────────────────────────────────────────────────┐
│  TLC fails at remote hop                                            │
│  │  Onion error packet carries: TlcErrorCode + TlcErrData           │
│  │  TlcErrData { node_id, channel_outpoint, ... }                  │
│  └──────────────────────────────────────────────────────────────────┤
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │  [onion.rs:118] TlcErrPacket::decode()                          │ │
│  │  │  Returns: DecodedTlcErr { error: TlcErr, hop_index: usize } │ │
│  │  │  ← hop_index EXISTS here                                     │ │
│  └──────────────────────────────────────────────────────────────────┤
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │  [payment.rs:1814] handle_remove_tlc_event()                    │ │
│  │  │  hop_index → route_index (for history)                       │ │
│  │  │  error.error_code_as_str() → attempt.last_error (STRING)    │ │
│  │  │  ← TlcErrData DROPPED                                        │ │
│  │  │  ← hop_index DROPPED after history update                    │ │
│  └──────────────────────────────────────────────────────────────────┤
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │  [store] insert_attempt(attempt)                                 │ │
│  │  │  Persists: route ✅  last_error (string) ✅                   │ │
│  │  │  LOST: hop_index ❌  TlcErrData (node_id, channel) ❌        │ │
│  │  │  LOST per-attempt: TlcErrorCode ❌                            │ │
│  └──────────────────────────────────────────────────────────────────┤
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │  [payment.rs:610] PaymentSession → SendPaymentResponse          │ │
│  │  │  Aggregates attempts → DROPS per-attempt data                │ │
│  │  │  Only session.last_error (string) survives                   │ │
│  │  │  routers: debug-only                                         │ │
│  └──────────────────────────────────────────────────────────────────┤
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │  [rpc/payment.rs:140] → GetPaymentCommandResult (JSON)          │ │
│  │  │  failed_error: Option<String>  ← just the string             │ │
│  │  │  routers: Vec<SessionRoute>    ← debug only                  │ │
│  └──────────────────────────────────────────────────────────────────┘
```

### The "Almost-There" Problem

Fiber **already stores** almost everything needed for rich route diagnostics:

- ✅ All attempts with full routes → in the store
- ✅ Per-attempt error strings → in the store  
- ✅ Session-level `TlcErrorCode` → in the store
- ✅ Route evolution across retries → implicit in attempt order

But **three gaps** prevent Lens from delivering on its promise:

1. **Hole in persistence**: `TlcErrData` (node_id, channel_outpoint) and `hop_index` decoded but never stored on `Attempt`
2. **Hole in RPC exposure**: `get_attempts()` exists but no RPC endpoint calls it; `SendPaymentResponse` aggregates/discards
3. **Hole in granularity**: `TlcErrorCode` stored only at session level, not per-attempt

---

## Recommended Fiber Enhancements

### Enhancement 1: Persist Failure Locality (Low Effort, High Impact)

Add two fields to [`Attempt`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:650):

```rust
pub struct Attempt {
    // ... existing fields ...
    pub last_error: Option<String>,
    pub last_error_code: Option<TlcErrorCode>,      // NEW: per-attempt error code
    pub failing_node: Option<Pubkey>,                // NEW: which node reported the failure
    pub failing_channel: Option<OutPoint>,            // NEW: which channel failed (if applicable)
}
```

Populate from `TlcErr` in [`handle_remove_tlc_event()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1847-1853) and [`handle_add_tlc_result_event()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1760-1766).

### Enhancement 2: Expose Attempts via RPC (Medium Effort, High Impact)

Add a new RPC method:

```json
// POST get_payment_attempts
{
  "payment_hash": "0x..."
}

// Response:
{
  "payment_hash": "0x...",
  "status": "Failed",
  "attempts": [
    {
      "id": 1,
      "status": "Failed",
      "error": "TemporaryChannelFailure",
      "error_code": 4103,
      "error_node": "0x02abc...",
      "tried_times": 3,
      "created_at": "0x...",
      "route": {
        "nodes": [
          { "pubkey": "0x...", "channel_outpoint": "0x...", "amount": "0x..." },
          ...
        ]
      }
    },
    {
      "id": 2,
      "status": "Success",
      "route": { ... }
    }
  ]
}
```

### Enhancement 3: Always Include Route in Response (Low Effort)

Remove the `#[cfg(debug_assertions)]` gate on the `routers` field in [`SendPaymentResponse`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\network.rs:600-601) and [`GetPaymentCommandResult`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-json-types\src\payment.rs:86-93). The route data is already stored — it's purely a visibility restriction.

### Enhancement 4: Per-Attempt Error Codes

Store `last_error_code: Option<TlcErrorCode>` on each `Attempt` (not just the session) so Lens can classify each attempt independently.

---

## Summary: Lens Capability Matrix

| Feature | Today (RPC) | Today (Store Access) | After Enhancement 1-3 |
|---------|-------------|----------------------|------------------------|
| Show payment status | ✅ | ✅ | ✅ |
| Show aggregated error | ✅ (string) | ✅ (string + code) | ✅ |
| Show exact route used | ❌ | ✅ | ✅ |
| Show failing hop | ❌ | ❌ | ✅ |
| Show failing node | ❌ | ❌ | ✅ |
| Show failing channel | ❌ | ❌ | ✅ |
| Show retry attempts | ❌ | ✅ | ✅ |
| Show route evolution | ❌ | ✅ (by comparing attempts) | ✅ |
| Classify failure per attempt | ❌ | Partial (string only) | ✅ |
| Show per-hop amounts | ❌ | ✅ | ✅ |
| Show per-hop channels | ❌ | ✅ | ✅ |
| Timeline of attempts | ❌ | ✅ (via timestamps) | ✅ |

---

*This document identifies exactly what route data Fiber stores, what it exposes, and the minimal code changes needed to unlock full route diagnostics for Fiber Lens.*
