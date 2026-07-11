# Fiber Payment Failure Reasons — Complete Codebase Map

> **Generated:** 2026-06-24  
> **Fiber branch:** `develop`  
> **Purpose:** Exhaustive map of every payment failure reason exposed by Fiber, tracing each from its definition point through production, propagation, and external exposure at the RPC boundary.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Failure Reason Taxonomy](#failure-reason-taxonomy)
3. [Layer 1: Canonical TLC Error Codes (`TlcErrorCode`)](#layer-1-canonical-tlc-error-codes-tlcerrorcode)
4. [Layer 2: Route-Building Failures (`PathFindError`)](#layer-2-route-building-failures-pathfinderror)
5. [Layer 3: Channel Processing Errors → TLC Error Mapping (`ProcessingChannelError`)](#layer-3-channel-processing-errors--tlc-error-mapping-processingchannelerror)
6. [Layer 4: Top-Level Application Errors (`Error` enum)](#layer-4-top-level-application-errors-error-enum)
7. [End-to-End Propagation Path](#end-to-end-propagation-path)
8. [RPC Exposure Surface](#rpc-exposure-surface)
9. [Retryability Determinants](#retryability-determinants)
10. [Implications for Fiber Lens](#implications-for-fiber-black-box)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  External Consumer (Wallet, CLI, Lens)                   │
│  │  JSON-RPC: send_payment / get_payment / list_payments     │
│  │  Returns: GetPaymentCommandResult { failed_error: String } │
└──────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │  [fiber-json-types/src/payment.rs] │  ← JSON serialization
          │  GetPaymentCommandResult           │
          │    .failed_error: Option<String>    │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │  [fiber-lib/src/rpc/payment.rs]    │  ← RPC handler layer
          │  PaymentRpcServerImpl              │
          │    send_payment_response_to_json() │
          │    .failed_error = response.failed_error
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │  [fiber-lib/src/fiber/network.rs]  │  ← Network actor layer
          │  SendPaymentResponse               │
          │    .failed_error: Option<String>    │
          │    .status: PaymentStatus          │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │  [fiber-lib/src/fiber/payment.rs]  │  ← Payment actor (core)
          │  PaymentActor                      │
          │    PaymentSession                  │
          │      .last_error: Option<String>    │
          │      .last_error_code: Option<TlcErrorCode>
          │    Attempt                         │
          │      .last_error: Option<String>   │
          └─────────────────┬─────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     │                      │                      │
     ▼                      ▼                      ▼
┌─────────────┐    ┌──────────────┐     ┌──────────────────┐
│ Route Build │    │ Channel Ops  │     │ History/Retry    │
│ graph.rs    │    │ channel.rs   │     │ history.rs       │
│ PathFindErr │    │ ProcChanErr  │     │ record_payment_  │
│             │    │ → TlcErrCode │     │ fail_with_index  │
└─────────────┘    └──────────────┘     └──────────────────┘
     │                      │                      │
     └──────────────────────┼──────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │  [fiber-types/src/payment.rs]      │  ← Type definitions
          │  TlcErrorCode (25 variants)        │
          │  TlcErr { error_code, extra_data } │
          │  PaymentSession, Attempt           │
          └───────────────────────────────────┘
```

---

## Failure Reason Taxonomy

Fiber exposes payment failure reasons through **four distinct layers**, each with its own error type. All eventual converge into `TlcErrorCode` and flow outward as a human-readable `String` via the `failed_error` field on `GetPaymentCommandResult`.

| Layer | Error Type | File | Count | Scope |
|-------|-----------|------|-------|-------|
| **L1** | `TlcErrorCode` | [`crates/fiber-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:804) | 25 | BOLT #4 protocol error codes — the canonical failure vocabulary |
| **L2** | `PathFindError` | [`crates/fiber-lib/src/fiber/graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:484) | 8 | Route construction failures (pre-flight) |
| **L3** | `ProcessingChannelError` | [`crates/fiber-lib/src/fiber/channel.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\channel.rs:4689) | 23 | Channel-level operational errors, mapped → TlcErrorCode |
| **L4** | `Error` (top-level) | [`crates/fiber-lib/src/errors.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\errors.rs:22) | 19 | Application-level errors (infrastructure, validation, IO) |

---

## Layer 1: Canonical TLC Error Codes (`TlcErrorCode`)

**Definition:** [`crates/fiber-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:789-830)

These are the **BOLT #4 onion routing failure codes**, encoded as `u16` values with bitwise flag prefixes:

| Flag | Value | Meaning |
|------|-------|---------|
| `BADONION` | `0x8000` | Onion packet is invalid |
| `PERM` | `0x4000` | Permanent error (otherwise transient) |
| `NODE` | `0x2000` | Node-related error (otherwise channel-related) |
| `UPDATE` | `0x1000` | Channel forwarding parameter was violated |

### Complete Enumeration (25 variants)

| # | Variant | Code (hex) | Flags | Name String | Retryable? | Description |
|---|---------|------------|-------|-------------|------------|-------------|
| 1 | `TemporaryNodeFailure` | `0x2002` | NODE | `TemporaryNodeFailure` | ✅ Yes | A node along the route is temporarily unavailable |
| 2 | `PermanentNodeFailure` | `0x6002` | PERM \| NODE | `PermanentNodeFailure` | ❌ No | A node has permanently failed; do not retry through it |
| 3 | `RequiredNodeFeatureMissing` | `0x6003` | PERM \| NODE | `RequiredNodeFeatureMissing` | ❌ No | A required feature is not supported by a node |
| 4 | `InvalidOnionVersion` | `0xC004` | BADONION \| PERM | `InvalidOnionVersion` | ❌ No | Onion packet version is unrecognized |
| 5 | `InvalidOnionHmac` | `0xC005` | BADONION \| PERM | `InvalidOnionHmac` | ❌ No | Onion HMAC validation failed |
| 6 | `InvalidOnionKey` | `0xC006` | BADONION \| PERM | `InvalidOnionKey` | ❌ No | Onion ephemeral key is invalid |
| 7 | `TemporaryChannelFailure` | `0x1007` | UPDATE | `TemporaryChannelFailure` | ✅ Yes | Channel is temporarily unable to forward (liquidity, rate-limit, etc.) |
| 8 | `PermanentChannelFailure` | `0x4008` | PERM | `PermanentChannelFailure` | ❌ No | Channel has permanently failed; do not retry through it |
| 9 | `RequiredChannelFeatureMissing` | `0x4009` | PERM | `RequiredChannelFeatureMissing` | ❌ No | A required feature is not supported by the channel |
| 10 | `UnknownNextPeer` | `0x400A` | PERM | `UnknownNextPeer` | ❌ No | The next peer specified in the route is unknown |
| 11 | `AmountBelowMinimum` | `0x100B` | UPDATE | `AmountBelowMinimum` | ✅ Yes | Payment amount is below the channel's `htlc_minimum_msat` |
| 12 | `FeeInsufficient` | `0x100C` | UPDATE | `FeeInsufficient` | ✅ Yes | Forwarding fee is below the channel's required fee |
| 13 | `IncorrectTlcExpiry` | `0x100D` | UPDATE | `IncorrectTlcExpiry` | ❌ No (mid-hop) | CLTV expiry was tampered with or is incorrect |
| 14 | `ExpiryTooSoon` | `0x400E` | PERM | `ExpiryTooSoon` | ❌ No | TLC expiry is too soon (insufficient time remaining) |
| 15 | `IncorrectOrUnknownPaymentDetails` | `0x400F` | PERM | `IncorrectOrUnknownPaymentDetails` | ❌ No | Payment hash/preimage/details are unknown or incorrect at final hop |
| 16 | `InvoiceExpired` | `0x4010` | PERM | `InvoiceExpired` | ❌ No | The invoice has expired |
| 17 | `InvoiceCancelled` | `0x4011` | PERM | `InvoiceCancelled` | ❌ No | The invoice has been cancelled |
| 18 | `FinalIncorrectExpiryDelta` | `0x0012` | (none) | `FinalIncorrectExpiryDelta` | ❌ No* | Final hop received incorrect CLTV expiry delta |
| 19 | `FinalIncorrectTlcAmount` | `0x0013` | (none) | `FinalIncorrectTlcAmount` | ❌ No* | Final hop received incorrect payment amount |
| 20 | `ChannelDisabled` | `0x1014` | UPDATE | `ChannelDisabled` | ✅ Yes | Channel is currently disabled (can retry with different route) |
| 21 | `ExpiryTooFar` | `0x4015` | PERM | `ExpiryTooFar` | ❌ No | TLC expiry is too far in the future |
| 22 | `InvalidOnionPayload` | `0x4016` | PERM | `InvalidOnionPayload` | ❌ No | Onion payload (TLV) is malformed or invalid |
| 23 | `HoldTlcTimeout` | `0x4017` | PERM | `HoldTlcTimeout` | ❌ No | The receiver held the TLC but failed to resolve it in time |
| 24 | `InvalidOnionError` | `0xC019` | BADONION \| PERM | `InvalidOnionError` | ❌ No | The returned error onion packet is itself invalid |
| 25 | `IncorrectTlcDirection` | `0x401A` | PERM | `IncorrectTlcDirection` | ❌ No | TLC was sent in the wrong direction on a one-way channel |

> `*` For `FinalIncorrectExpiryDelta` / `FinalIncorrectTlcAmount`: retryable only when the route has intermediate hops (len > 2); if direct peer (len == 2), not retryable.

### Where TlcErrorCodes Are Produced

**A. Channel Actor** — [`crates/fiber-lib/src/fiber/channel.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\channel.rs:971-1039)

The function `ProcessingChannelError::to_tlc_error_code()` maps every `ProcessingChannelError` variant to its corresponding `TlcErrorCode`. This is the **primary production point** for errors that originate during channel operations (TLC forwarding, settlement checks). See [Layer 3](#layer-3-channel-processing-errors--tlc-error-mapping-processingchannelerror) for the full mapping.

**B. History / Retry Engine** — [`crates/fiber-lib/src/fiber/history.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:266-410)

`record_payment_fail_with_index()` consumes a `TlcErr` and determines:
- Whether the payment should be retried (`need_retry`)
- Which nodes/channel-pairs to penalize in the routing graph

**C. Trampoline Forwarding** — [`crates/fiber-lib/src/fiber/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:66,73,1460,1466)

Hardcoded assignments:
- `TlcErrorCode::IncorrectTlcExpiry` — when trampoline outgoing TLC expiry exceeds upstream budget
- `TlcErrorCode::FeeInsufficient` — when trampoline forwarding fee exceeds remaining budget
- `TlcErrorCode::TemporaryNodeFailure` — default for failed trampoline-assisted route builds

### Error Extra Data (`TlcErrData`)

**Definition:** [`crates/fiber-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:163-179)

Each `TlcErr` may carry structured extra data:

| Variant | Fields | Use |
|---------|--------|-----|
| `ChannelFailed` | `channel_outpoint`, `channel_update` (optional), `node_id` | Identifies the failing channel; `channel_update` may carry updated routing parameters |
| `NodeFailed` | `node_id` | Identifies the failing node |
| `TrampolineFailed` | `node_id`, `inner_error_packet` | Wraps an inner error from beyond a trampoline hop |

---

## Layer 2: Route-Building Failures (`PathFindError`)

**Definition:** [`crates/fiber-lib/src/fiber/graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:484-501)

These errors occur **before any HTLC is dispatched** — during route computation. They are converted to `Error::SendPaymentError` (with string message) or `Error::BuildPaymentRouteError` in [`payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1189-1191,1295-1305).

| # | Variant | Description | Produced When |
|---|---------|-------------|---------------|
| 1 | `Amount(String)` | Invalid amount specification | Amount = 0, amount + max_fee overflows, hop amount = 0 |
| 2 | `NoPathFound` | No viable route exists in the network graph | Insufficient connectivity, all candidate paths exhausted, channel not found, UDT type mismatch |
| 3 | `Overflow(String)` | Arithmetic overflow during path computation | Fee/tlc_expiry/amount calculations overflow u128/u64 bounds |
| 4 | `FeatureNotEnabled(String)` | Required feature not enabled | Self-payment without `allow_self_payment`, MPP not supported by target, trampoline hop invalid |
| 5 | `UnknownNode(String)` | Node not found in graph | Target/route node not in the network graph |
| 6 | `InsufficientBalance(String)` | Outbound liquidity insufficient | Total outbound < amount, max single-channel outbound < amount |
| 7 | `TlcMinValue(u128)` | Amount below channel minimum | `htlc_minimum_msat` constraint violated |
| 8 | `Other(String)` | Catch-all | Trampoline fee estimation failures, expired onion packet, duplicate nodes in route |

### Key Production Sites

| Location | File | Lines |
|----------|------|-------|
| `build_route()` entry checks | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1260) | 1260–1309 |
| Explicit route validation | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1402) | 1402–1506 |
| Trampoline route building | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1518) | 1518–1705 |
| MPP path search loop | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1847) | 1847–1922 |
| `find_path()` top-level | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:2240) | 2240–2312 |
| `find_path_hop_hints()` | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:2403) | 2403–2708 |
| `build_router_from_hops()` | [`graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:2885) | 2885–3016 |

---

## Layer 3: Channel Processing Errors → TLC Error Mapping (`ProcessingChannelError`)

**Definition:** [`crates/fiber-lib/src/fiber/channel.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\channel.rs:4689-4748)

**Mapping function:** [`crates/fiber-lib/src/fiber/channel.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\channel.rs:971-1039) — `to_tlc_error_code()`

This is the **critical bridge**: every channel-level operational error is converted to a `TlcErrorCode` that gets embedded in a `TlcErr` onion error packet and propagated back to the sender.

| ProcessingChannelError | → TlcErrorCode | Explanation |
|------------------------|----------------|-------------|
| `PeelingOnionPacketError(_)` | `InvalidOnionPayload` | Onion decryption/parsing failed at forwarding hop |
| `TlcForwardFeeIsTooLow` | `FeeInsufficient` | Forwarding fee below channel's configured minimum |
| `TlcExpirySoon` | `ExpiryTooSoon` | TLC expiry is too close to current time |
| `TlcExpiryTooFar` | `ExpiryTooFar` | TLC expiry exceeds maximum allowed |
| `FinalInvoiceInvalid(Expired)` | `InvoiceExpired` | Invoice at final hop has expired |
| `FinalInvoiceInvalid(Cancelled)` | `InvoiceCancelled` | Invoice at final hop has been cancelled |
| `FinalInvoiceInvalid(Open)` | `IncorrectOrUnknownPaymentDetails` | Invoice is "Open" but something else is wrong |
| `FinalIncorrectPreimage` | `IncorrectOrUnknownPaymentDetails` | Preimage doesn't match payment hash |
| `FinalIncorrectPaymentHash` | `IncorrectOrUnknownPaymentDetails` | Payment hash unknown/incorrect at final hop |
| `FinalIncorrectMPPInfo(_)` | `IncorrectOrUnknownPaymentDetails` | MPP payment secret/amount mismatch |
| `FinalIncorrectHTLCAmount` | `FinalIncorrectTlcAmount` | Final hop received wrong HTLC amount |
| `IncorrectTlcExpiry` | `IncorrectTlcExpiry` | CLTV expiry tampered or incorrect |
| `IncorrectTlcDirection` | `IncorrectTlcDirection` | TLC sent in wrong direction on one-way channel |
| `IncorrectFinalTlcExpiry` | `FinalIncorrectExpiryDelta` | Final hop CLTV expiry delta incorrect |
| `TlcAmountIsTooLow` | `AmountBelowMinimum` | TLC amount below `htlc_minimum_msat` |
| `TlcNumberExceedLimit` | `TemporaryChannelFailure` | Too many pending TLCs on channel |
| `TlcAmountExceedLimit` | `TemporaryChannelFailure` | Channel TLC amount capacity exceeded |
| `TlcValueInflightExceedLimit` | `TemporaryChannelFailure` | In-flight value exceeds channel limit |
| `WaitingTlcAck` | `TemporaryChannelFailure` | Channel awaiting ACK from peer (backpressure) |
| `InternalError(_)` | `TemporaryNodeFailure` | Internal node error (transient) |
| `InvalidState(ShuttingDown)` | `PermanentChannelFailure` | Channel is shutting down (permanent) |
| `InvalidState(_)` (other) | `TemporaryNodeFailure` | Other invalid states treated as transient node errors |
| `RepeatedProcessing(_)` | `TemporaryChannelFailure` | Duplicate message processing |
| `SpawnErr(_)` / `Musig2*` / `CapacityError(_)` | `TemporaryNodeFailure` | Internal actor/system errors |
| `InvalidParameter(_)` | `IncorrectOrUnknownPaymentDetails` | Invalid payment parameters |
| `TlcForwardingError(_)` | *(unreachable – handled before mapping)* | Pre-resolved forwarding errors |
| `ToBeAcceptedChannelsExceedLimit(_)` | *(unreachable – handled before mapping)* | Pre-channel-open limit |

---

## Layer 4: Top-Level Application Errors (`Error` enum)

**Definition:** [`crates/fiber-lib/src/errors.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\errors.rs:22-82)

These are non-TLC errors that bubble up to the RPC layer as JSON-RPC error objects (not as `failed_error` strings on a successful response). They prevent payment execution entirely.

| # | Variant | Description |
|---|---------|-------------|
| 1 | `IO(std::io::Error)` | Filesystem/network IO failure |
| 2 | `PeerNotFound(Pubkey)` | Target peer not in peer store |
| 3 | `NoMatchingAddress(Pubkey, TransportType)` | No address for specified transport |
| 4 | `NoSupportedAddress(Pubkey)` | No supported address at all |
| 5 | `ChannelNotFound(Hash256)` | Channel lookup failed |
| 6 | `TentacleSend(SendErrorKind)` | Network message send failure |
| 7 | `SpawnErr(SpawnErr)` | Actor spawn failure |
| 8 | `ChannelMessagingErr(...)` | Channel actor message delivery failure |
| 9 | `NetworkMessagingErr(...)` | Network actor message delivery failure |
| 10 | `InFlightCkbTxActorMessagingErr(...)` | CKB transaction actor failure |
| 11 | `ChannelError(ProcessingChannelError)` | Wrapped channel processing error |
| 12 | `CkbInvoiceError(InvoiceError)` | Invoice parsing/validation failure |
| 13 | `FundingError(FundingError)` | Channel funding error |
| 14 | **`BuildPaymentRouteError(String)`** | Route building failed → ends up as `failed_error` |
| 15 | **`SendPaymentError(String)`** | Payment send failed → ends up as `failed_error` |
| 16 | **`FirstHopError(String, bool)`** | First hop failure; bool = retryable → ends up as `failed_error` |
| 17 | `InvalidParameter(String)` | Invalid RPC parameter |
| 18 | `DeferredChannelAnnouncementVerification(...)` | Channel announcement deferred |
| 19 | `NetworkGraphError(PathFindError)` | Wrapped route-finding error |
| 20 | `InvalidPeerMessage(String)` | Malformed peer message |
| 21 | `InvalidOnionPacket(...)` | Onion construction failure |
| 22 | `CkbRpcError(RpcError)` | CKB chain RPC error |
| 23 | `DBInternalError(String)` | Database operation failure |
| 24 | `InternalError(anyhow::Error)` | Catch-all internal error |
| 25 | `InvalidChainHash(...)` | Chain hash mismatch |
| 26 | `SecretKeyFileError(String)` | Key file error |

The three bolded variants (`BuildPaymentRouteError`, `SendPaymentError`, `FirstHopError`) are the ones that **flow into `PaymentSession.last_error`** (as strings) and ultimately become the user-visible `failed_error` field.

---

## End-to-End Propagation Path

### Path A: Remote TLC Failure (most common)

```
1. Sender node sends onion packet via channel → network
2. Intermediate/final node processes AddTlc
   └─ [channel.rs:1507] verify_and_insert_incoming_tlc()
      └─ May return ProcessingChannelError
3. Channel actor maps error → TlcErrorCode
   └─ [channel.rs:971] to_tlc_error_code()
4. TlcErr onion error packet is sent back through the route
5. Sender's channel receives RemoveTlcFail
   └─ [payment.rs:1813] handle_remove_tlc_event()
6. Error is decoded from the onion packet
   └─ [payment.rs:1814-1824] reason.decode()
   └─ Falls back to InvalidOnionError if decode fails
7. Attempt recorded as failed
   └─ [graph.rs:1187] record_attempt_fail() / record_attempt_fail_at_hop()
   └─ [history.rs:266] record_payment_fail_with_index() → determines retryability
8. PaymentSession.last_error / last_error_code updated
   └─ [payment.rs:1552] set_payment_fail_with_error()
   └─ [payment.rs:1570] set_attempt_fail_with_error()
9. If all attempts exhausted → PaymentSession.status = Failed
10. PaymentSession → SendPaymentResponse
    └─ [payment.rs:610] From<PaymentSession> for SendPaymentResponse
    └─ .failed_error = session.last_error
11. SendPaymentResponse → GetPaymentCommandResult
    └─ [rpc/payment.rs:140] send_payment_response_to_json()
    └─ .failed_error = response.failed_error.clone()
```

### Path B: First-Hop Failure (local channel cannot send)

```
1. PaymentActor sends onion packet → network
   └─ [payment.rs:1475] send_payment_onion_packet()
2. Channel actor returns error immediately
   └─ First hop AddTlc fails (WaitingTlcAck, or actual error)
   └─ [payment.rs:1722] handle_add_tlc_result_event()
3. TlcErr is extracted from the channel error
   └─ [payment.rs:1752-1761]
4. Attempt recorded as failed (same as Path A steps 7-11)
5. If retryable → PaymentActor retries after delay
   └─ [payment.rs:1886] register_payment_retry()
```

### Path C: Route Building Failure (no HTLC ever sent)

```
1. PaymentActor tries to build routes
   └─ [payment.rs:1209] build_payment_routes()
2. NetworkGraph.build_route() → PathFindError
   └─ [graph.rs:1260]
3. PathFindError → Error::SendPaymentError(String)
   └─ [payment.rs:1294-1305]
4. PaymentSession.last_error set with error string
   └─ [payment.rs:1642] set_payment_fail_with_error()
5. PaymentSession → SendPaymentResponse (same as Path A steps 10-11)
```

### Path D: Validation / Parameter Error (pre-flight)

```
1. RPC handler validates parameters
   └─ [payment.rs:337] SendPaymentDataBuilder::build()
   └─ [payment.rs:380] SendPaymentDataExt::new()
2. Returns Err(String) → Error::InvalidParameter(String)
3. Returned as JSON-RPC error to caller (NOT as failed_error)
```

---

## RPC Exposure Surface

### JSON-RPC Methods

All defined in [`crates/fiber-lib/src/rpc/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\rpc\payment.rs:31-78):

| Method | Returns | How Failure Appears |
|--------|---------|---------------------|
| `send_payment` | `GetPaymentCommandResult` | `.failed_error: Option<String>` contains the human-readable error |
| `get_payment` | `GetPaymentCommandResult` | `.failed_error: Option<String>` from stored session |
| `send_payment_with_router` | `GetPaymentCommandResult` | Same as `send_payment` |
| `list_payments` | `ListPaymentsResult` | Each `.payments[i].failed_error` from stored sessions |
| `build_router` | `BuildPaymentRouterResult` | Errors returned as JSON-RPC errors (not `failed_error`) |

### JSON Response Type

**File:** [`crates/fiber-json-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-json-types\src\payment.rs:63-94)

```rust
pub struct GetPaymentCommandResult {
    pub payment_hash: Hash256,
    pub status: PaymentStatus,          // Created | Inflight | Success | Failed
    pub created_at: u64,                // ms since UNIX epoch
    pub last_updated_at: u64,           // ms since UNIX epoch
    pub failed_error: Option<String>,   // ← THE FAILURE REASON (human-readable)
    pub fee: u128,
    pub custom_records: Option<PaymentCustomRecords>,
    #[cfg(debug_assertions)]
    pub routers: Vec<SessionRoute>,     // Only in debug mode
}
```

### The `failed_error` String Format

The `failed_error` string is built from:
- **`TlcErrorCode::as_ref().to_string()`** — the enum variant name (e.g., `"TemporaryChannelFailure"`, `"FeeInsufficient"`)
- **`Error::to_string()`** — for route-building errors (e.g., `"Failed to build route, ..."`)
- **`ProcessingChannelError::to_string()`** — for channel-level errors from `handle_add_tlc_result_event`
- These are stored as `Attempt::last_error` / `PaymentSession::last_error`

**Concrete examples observed in the codebase:**
```
"TemporaryChannelFailure"
"FeeInsufficient"
"IncorrectOrUnknownPaymentDetails"
"Failed to build route, Insufficient balance: total outbound liquidity 1000 is insufficient, required amount: 5000"
"Can not send payment with limited attempts"
"Failed to build enough routes for MPP payment"
```

---

## Retryability Determinants

**File:** [`crates/fiber-lib/src/fiber/history.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:266-410)

Retryability is determined by `record_payment_fail_with_index()` which categorizes errors based on **where in the route** they occurred (source node / intermediate hop / final hop) and the error code. Additionally, `record_attempt_fail()` in [`graph.rs:1187`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1187-1205) disables retries for `send_payment_with_router` calls.

### Always Non-Retryable (terminal)

These error codes cause `need_retry = false` regardless of hop position:

| Error Code | Condition |
|------------|-----------|
| `InvalidOnionVersion` | At source node |
| `InvalidOnionHmac` | At source node |
| `InvalidOnionKey` | At source node |
| `InvalidOnionPayload` | At source node |
| `IncorrectOrUnknownPaymentDetails` | At source node, final node, or middle hop |
| `InvoiceExpired` | At source node, final node, or middle hop |
| `InvoiceCancelled` | At source node, final node, or middle hop |
| `UnknownNextPeer` | At source node |
| `RequiredNodeFeatureMissing` | At source node or final node |
| `ExpiryTooSoon` | At source node or final node |
| `ExpiryTooFar` | At source node or final node |
| `HoldTlcTimeout` | At source node, final node, or middle hop |
| `PermanentNodeFailure` | At final node |
| `RequiredChannelFeatureMissing` | At final node |
| `FinalIncorrectExpiryDelta` | At final node (only when route has 2 hops) |
| `FinalIncorrectTlcAmount` | At final node (only when route has 2 hops) |
| `IncorrectTlcExpiry` | At middle hop |
| `IncorrectTlcDirection` | At middle hop |

### Generally Retryable (transient)

| Error Code | Retry Behavior |
|------------|---------------|
| `TemporaryChannelFailure` | Retries; penalizes the channel pair with balance-based damping |
| `TemporaryNodeFailure` | Retries; penalizes the channel pair |
| `ChannelDisabled` | Retries; penalizes the channel pair |
| `AmountBelowMinimum` | Retries; penalizes the channel pair |
| `FeeInsufficient` | Retries (middle hop only); penalizes the channel pair |

### Additional Retry Constraints

- **Max retry limit:** `try_limit` on `PaymentSession` (default: 3 per attempt in MPP mode, configurable otherwise)
- **Max parts:** `send_payment_with_router` disables all retries
- **Trampoline errors:** Never retryable (inner route chosen by trampoline node, not the payer)
- **Dry run:** No retries (route inspection only)

---

## Hop Index Tracking: Decoded But Not Persisted

Fiber **internally decodes** the exact hop index that produced a failure, but **discards it** after transient processing. It is never persisted or exposed via RPC.

### Where the hop index is decoded

**File:** [`crates/fiber-types/src/onion.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:117-148)

When the sender receives a `RemoveTlcFail` event, the raw onion error packet is decoded via [`TlcErrPacket::decode()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:118):

```rust
// onion.rs:117-148
pub fn decode(&self, session_key: &[u8; 32], hops_public_keys: Vec<Pubkey>) -> Option<DecodedTlcErr> {
    // ...
    OnionErrorPacket::from_bytes(self.onion_packet.clone())
        .parse(hops_public_keys, session_key, TlcErr::deserialize)
        .map(|(error, hop_index)| {
            // 27 constant-time decryption passes to prevent timing analysis
            DecodedTlcErr { error, hop_index }  // ← ZERO-BASED hop index
        })
}
```

The [`DecodedTlcErr`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:37-41) struct contains:

| Field | Type | Meaning |
|-------|------|---------|
| `error` | `TlcErr` | The decoded error with `TlcErrorCode` + optional `TlcErrData` (node_id, channel_outpoint) |
| `hop_index` | `usize` | Zero-based index into the **hop public keys** identifying exactly which hop generated the failure |

### Where the hop index is consumed

**File:** [`crates/fiber-lib/src/fiber/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1813-1853)

In [`handle_remove_tlc_event()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1813), the decoded `hop_index` is mapped to a route index and passed to history:

```rust
// payment.rs:1814-1824
match reason.decode(&attempt.session_key, attempt.hops_public_keys()) {
    Some(decoded) if decoded.hop_index.saturating_add(1) < attempt.route.nodes.len() => {
        (decoded.error, Some(decoded.hop_index + 1))  // route_index = hop_index + 1 (source is index 0)
    }
    _ => {
        // Decode failure → fallback to InvalidOnionError without positional info
        (TlcErr::new(TlcErrorCode::InvalidOnionError), None)
    }
};
```

The `route_index` is consumed immediately in two call paths:

1. **With valid route_index:** [`record_attempt_fail_at_hop()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1210-1225) → [`record_payment_fail_with_index()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:266-410)
2. **Without route_index (decode failure):** [`record_attempt_fail()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs:1187-1204) → [`record_payment_fail()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:238-263)

Both paths converge at [`record_payment_fail_with_index()`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:266) which uses the index to:
- Determine **retryability** (different rules for source/index=0, middle, and final hops — see [Retryability Determinants](#retryability-determinants))
- **Penalize** the specific node or channel-pair in the routing graph's `PaymentHistory` for future pathfinding decisions

**After this, the hop index is gone.** It is consumed entirely within the history update and never stored on any persistent data structure.

### What IS persisted (no hop index)

| Struct | Field | Contains Hop Index? | File:Line |
|--------|-------|---------------------|-----------|
| `Attempt` | `last_error: Option<String>` | ❌ String only | [`payment.rs:663`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:663) |
| `PaymentSession` | `last_error: Option<String>` | ❌ String only | [`payment.rs:890`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:890) |
| `PaymentSession` | `last_error_code: Option<TlcErrorCode>` | ❌ Error code only | [`payment.rs:892`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs:892) |
| `SendPaymentResponse` | `failed_error: Option<String>` | ❌ String only | [`network.rs:597`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\network.rs:597) |
| `GetPaymentCommandResult` | `failed_error: Option<String>` | ❌ String only | [`payment.rs:77`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-json-types\src\payment.rs:77) |

The `TlcErr.extra_data: Option<TlcErrData>` **can** carry the failing node's identity:

| TlcErrData variant | Fields | Identifies |
|--------------------|--------|------------|
| `ChannelFailed` | `node_id`, `channel_outpoint`, `channel_update` | Which channel failed |
| `NodeFailed` | `node_id` | Which node failed |
| `TrampolineFailed` | `node_id`, `inner_error_packet` | Which trampoline node reported the failure |

But this structured data is also **not persisted** on `Attempt` or `PaymentSession` — it is consumed transiently and discarded.

### RPC surface: hop index is absent

The `GetPaymentCommandResult` JSON-RPC response contains:

```json
{
  "payment_hash": "0x...",
  "status": "Failed",
  "failed_error": "TemporaryChannelFailure",   // ← opaque string only
  "fee": "0x...",
  "created_at": "0x...",
  "last_updated_at": "0x..."
}
```

- ❌ No `hop_index` field
- ❌ No `error_code` (numeric) field
- ❌ No `error_node` (failing node pubkey) field
- ❌ No `error_channel` (failing channel outpoint) field
- The `routers` field shows the full route with node pubkeys per hop, but is `#[cfg(debug_assertions)]` only

### Summary

| Question | Answer |
|----------|--------|
| Does Fiber internally decode the hop index? | **Yes** — via `TlcErrPacket::decode()` → `DecodedTlcErr.hop_index` |
| Where is it decoded? | [`onion.rs:118-148`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\onion.rs:118) |
| Where is it consumed? | [`payment.rs:1814-1824`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs:1814) → [`history.rs:266-410`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs:266) for retryability + graph penalization |
| Is it persisted? | **No** — `Attempt.last_error` and `PaymentSession.last_error` are opaque strings |
| Is it accessible via RPC? | **No** — `GetPaymentCommandResult.failed_error` is `Option<String>` |
| What would expose it? | The `DecodedTlcErr.hop_index` and `TlcErr.extra_data` (node_id, channel_outpoint) would need to be stored on `Attempt`/`PaymentSession` and serialized through `SendPaymentResponse` → `GetPaymentCommandResult` |

---

## Implications for Fiber Lens

### 1. Classification Mapping

The MVP's five diagnostic categories (from [`PRODUCT_MVP.md`](PRODUCT_MVP.md:242-342)) should be mapped to the canonical `TlcErrorCode` values:

| Lens Category | Fiber TlcErrorCode(s) | Confidence |
|-------------------|----------------------|------------|
| **Liquidity Failure** | `TemporaryChannelFailure`, `AmountBelowMinimum`, `FeeInsufficient` | High |
| **Routing Failure** | `UnknownNextPeer`, `PermanentChannelFailure`, `ChannelDisabled`, `RequiredChannelFeatureMissing` | High |
| **Timeout** | `ExpiryTooSoon`, `ExpiryTooFar`, `IncorrectTlcExpiry`, `FinalIncorrectExpiryDelta`, `HoldTlcTimeout` | High |
| **Peer Offline** | `TemporaryNodeFailure`, `PermanentNodeFailure` | Medium |
| **Fee Constraint** | `FeeInsufficient` (when accompanied by explicit fee data) | Medium |
| **Invoice/Payment Detail Error** | `IncorrectOrUnknownPaymentDetails`, `InvoiceExpired`, `InvoiceCancelled`, `FinalIncorrectTlcAmount` | High |
| **Onion/Packet Error** | `InvalidOnionVersion`, `InvalidOnionHmac`, `InvalidOnionKey`, `InvalidOnionPayload`, `InvalidOnionError` | Medium |
| **Unknown Failure** | Any unrecognized string, `PathFindError::Other`, `InternalError` | Low |

### 2. Critical Missing Data

The current RPC response **only exposes `failed_error` as an opaque string**. The `TlcErrorCode` numeric code and `TlcErrData` (channel outpoint, failing node) are **NOT** exposed via RPC. This means Fiber Lens currently has to:

- **Parse the error string** heuristically to infer the error code
- **Cannot identify** which specific channel/node caused the failure from the RPC alone

### 3. Recommended Fiber Enhancement

For optimal Lens integration, Fiber should be extended to expose:

```json
{
  "failed_error": "TemporaryChannelFailure",
  "failed_error_code": 4103,
  "failed_error_category": "UPDATE",
  "failed_error_details": {
    "error_node": "0x02...",
    "error_channel_outpoint": "0x..."
  }
}
```

This data already exists internally in `TlcErr` and `PaymentSession.last_error_code` — it simply needs to be serialized through the RPC layer.

### 4. Key Files Summary

| File | Role |
|------|------|
| [`crates/fiber-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-types\src\payment.rs) | **Canonical type definitions**: `TlcErrorCode` (25 variants), `TlcErr`, `TlcErrData`, `PaymentSession`, `Attempt`, `PaymentStatus` |
| [`crates/fiber-lib/src/fiber/channel.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\channel.rs) | **Error production**: `ProcessingChannelError` → `TlcErrorCode` mapping (the bridge), TLC validation/forwarding/settlement |
| [`crates/fiber-lib/src/fiber/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\payment.rs) | **Core engine**: `PaymentActor`, route building, onion sending, attempt management, error aggregation into `PaymentSession` |
| [`crates/fiber-lib/src/fiber/graph.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\graph.rs) | **Route finding**: `PathFindError` (8 variants), `build_route()`, liquidity/connectivity checks |
| [`crates/fiber-lib/src/fiber/history.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\history.rs) | **Retry logic**: `record_payment_fail_with_index()`, node/channel penalization, retryability decisions |
| [`crates/fiber-lib/src/fiber/network.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\fiber\network.rs) | **Response struct**: `SendPaymentResponse` (internal) with `failed_error: Option<String>` |
| [`crates/fiber-lib/src/errors.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\errors.rs) | **Application errors**: Top-level `Error` enum, wraps all sub-errors |
| [`crates/fiber-lib/src/rpc/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\rpc\payment.rs) | **RPC layer**: `send_payment`, `get_payment`, `list_payments` — converts internal response to JSON |
| [`crates/fiber-json-types/src/payment.rs`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-json-types\src\payment.rs) | **JSON schema**: `GetPaymentCommandResult`, `ListPaymentsResult` — defines the external API surface |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total unique `TlcErrorCode` variants | **25** |
| Total unique `PathFindError` variants | **8** |
| Total unique `ProcessingChannelError` variants | **23** |
| Total unique top-level `Error` variants | **26** |
| **Total distinct failure reason types across all layers** | **82** |
| Error codes that are always non-retryable | **17** |
| Error codes that are generally retryable | **5** |
| Error codes whose retryability depends on hop position | **3** |

---

*This document serves as the definitive reference for the Fiber Lens Diagnostics Engine's failure classification logic. All 25 canonical `TlcErrorCode` variants, their production points, propagation paths, and mapping layers are documented above.*
