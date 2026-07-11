# Fiber Node Setup Guide

> How to install, configure, and run a Fiber Network Node (FNN) for use with Fiber Lens.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Node](#running-the-node)
5. [RPC Reference](#rpc-reference)
6. [Connecting Lens](#connecting-black-box)
7. [Example Requests](#example-requests)
8. [TypeScript Client](#typescript-client)

---

## Prerequisites

- **Rust** — Install via [rustup.rs](https://rustup.rs)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **CKB CLI** (for wallet key setup) — [GitHub releases](https://github.com/nervosnetwork/ckb-cli/releases)
- **Git** — For cloning the repository

Verify:
```bash
rustc --version   # ≥ 1.80
cargo --version
git --version
```

---

## Installation

### Option 1: Build from Source

```bash
# Clone the repository
git clone https://github.com/nervosnetwork/fiber.git
cd fiber

# Checkout develop branch (latest)
git checkout develop

# Build (takes 5–15 minutes first time)
cargo build --release

# Binary location
ls target/release/fnn        # Linux/Mac
dir target\release\fnn.exe   # Windows
```

### Option 2: Pre-built Binary (Docker)

```bash
docker pull nervos/fiber:latest
```

See [`docker/README.md`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\docker\README.md) in the Fiber repo for Docker setup.

---

## Configuration

### Testnet Configuration

The testnet config is at [`config/testnet/config.yml`](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\config\testnet\config.yml).

**Key settings:**

| Setting | Default | Description |
|---------|---------|-------------|
| `fiber.listening_addr` | `/ip4/0.0.0.0/tcp/8228` | P2P port for peer connections |
| `rpc.listening_addr` | `127.0.0.1:8227` | JSON-RPC HTTP port (**localhost only — no auth**) |
| `ckb.rpc_url` | `https://testnet.ckbapp.dev/` | CKB chain RPC endpoint |
| `fiber.chain` | `testnet` | Chain to connect to |
| `services` | `[fiber, rpc, ckb]` | Services to enable |

### Create a Node Data Directory

```bash
mkdir ~/fiber-testnet
cp target/release/fnn ~/fiber-testnet/
cp config/testnet/config.yml ~/fiber-testnet/
cd ~/fiber-testnet
```

### Set Up Wallet Key

FNN has a built-in wallet for signing funding transactions.

```bash
# Create key directory
mkdir ckb

# Generate or import a private key using ckb-cli
ckb-cli account export --lock-arg <your_lock_arg> --extended-privkey-path ./ckb/exported-key

# FNN only needs the private key part (first line)
head -n 1 ./ckb/exported-key > ./ckb/key
rm ./ckb/exported-key
```

> **Note:** The private key is stored as plaintext in `ckb/key`. It will be encrypted at startup using `FIBER_SECRET_KEY_PASSWORD`.

---

## Running the Node

### Start Command

```bash
FIBER_SECRET_KEY_PASSWORD='your_password' RUST_LOG='info' ./fnn -c config.yml -d .
```

| Flag / Env | Description |
|------------|-------------|
| `-c config.yml` | Path to config file |
| `-d .` | Data directory (stores DB, keys, logs) |
| `FIBER_SECRET_KEY_PASSWORD` | **Required** — encrypts the wallet private key |
| `RUST_LOG` | Log level: `info`, `debug`, `trace`, or `info,fnn=debug` |

### Verify the Node is Running

```bash
curl -X POST http://localhost:8227 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"node_info","params":[]}'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "version": "0.8.0",
    "pubkey": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
    "chain_hash": "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
    "channel_count": "0x0",
    "peers_count": "0x0"
  }
}
```

### Connect to Testnet Peers

The testnet config includes two bootnodes. Your node will auto-connect on startup.

To manually connect to a peer:
```bash
curl -X POST http://localhost:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "connect_peer",
    "params": [{
      "address": "/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy"
    }]
  }'
```

---

## RPC Reference

### Default Ports

| Service | Port | Protocol | Binding |
|---------|------|----------|---------|
| P2P (fiber) | `8228` | TCP | `0.0.0.0` (public) |
| JSON-RPC | `8227` | HTTP | `127.0.0.1` (localhost only) |

### Authentication

**None.** The RPC server binds to `127.0.0.1` only. It does **not** require authentication tokens, API keys, or passwords. Do NOT expose the RPC port to the public internet — use a reverse proxy with auth if remote access is needed.

> From Fiber docs: *"Allowing arbitrary machines to access the JSON-RPC port is dangerous and strongly discouraged. Please strictly limit the access to only trusted machines."*

### Protocol

All RPC calls use **JSON-RPC 2.0** over HTTP POST.

**Request format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "<method_name>",
  "params": [...]
}
```

**Response format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

### Payment RPC Methods

| Method | Purpose | Key Params |
|--------|---------|------------|
| `send_payment` | Send a payment | `target_pubkey`, `amount`, `payment_hash`, `invoice`, `max_fee_amount`, `max_parts`, `keysend`, `hop_hints`, `dry_run` |
| `get_payment` | Get payment details | `payment_hash` |
| `list_payments` | List payment history | `limit`, `after` (cursor), `status` |
| `build_router` | Build a manual route | `amount`, `hops_info`, `final_tlc_expiry_delta` |
| `send_payment_with_router` | Send via explicit route | `payment_hash`, `router`, `keysend`, `dry_run` |

### Other Useful RPC Methods

| Method | Purpose |
|--------|---------|
| `node_info` | Node version, pubkey, features, addresses |
| `list_channels` | All open channels with balances |
| `list_peers` | Connected peers |
| `graph_nodes` | Network graph — all known nodes |
| `graph_channels` | Network graph — all known channels |
| `new_invoice` | Create an invoice |
| `get_invoice` | Get invoice details |
| `connect_peer` | Connect to a peer |
| `disconnect_peer` | Disconnect from a peer |

---

## Connecting Lens

Once your Fiber node is running, point Lens at it:

```bash
# Windows CMD
set FIBER_RPC_URL=http://localhost:8227

# Linux/Mac
export FIBER_RPC_URL=http://localhost:8227
```

Then start Lens:
```bash
cd Fibre-Lens/backend
npm run dev
```

The backend will auto-connect, sync payment data every 5 minutes, and run diagnostics.

---

## Example Requests

### Send a Payment

```bash
curl -X POST http://localhost:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "send_payment",
    "params": [{
      "target_pubkey": "0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
      "amount": "0x5f5e100",
      "payment_hash": null,
      "invoice": "fiber1...",
      "max_fee_amount": "0x3e8",
      "max_parts": "0x3",
      "keysend": false,
      "dry_run": false
    }]
  }'
```

### List Payments (Failed Only)

```bash
curl -X POST http://localhost:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "list_payments",
    "params": [{
      "limit": "0x14",
      "status": "Failed"
    }]
  }'
```

### Get a Specific Payment

```bash
curl -X POST http://localhost:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_payment",
    "params": [{
      "payment_hash": "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
    }]
  }'
```

### Analyze a Failed Payment via Lens

```bash
curl -X POST http://localhost:3001/api/v1/payments/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "payment_hash": "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
  }'
```

Response:
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
    "summary": "Insufficient liquidity: TemporaryChannelFailure",
    "recommendations": [
      "Retry the payment later",
      "Rebalance your channels",
      "Open additional channels"
    ]
  }
}
```

---

## TypeScript Client

### Direct Fiber RPC Client

```typescript
// fiber-rpc-client.ts
class FiberRpcClient {
  constructor(private url = "http://localhost:8227") {}

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  // Payment methods
  async listPayments(limit = 50, after?: string, status?: string) {
    return this.call("list_payments", [{ limit: `0x${limit.toString(16)}`, after, status }]);
  }

  async getPayment(paymentHash: string) {
    return this.call("get_payment", [{ payment_hash: paymentHash }]);
  }

  async sendPayment(params: {
    targetPubkey: string;
    amount: string;
    paymentHash?: string;
    invoice?: string;
    maxFeeAmount?: string;
    maxParts?: number;
    keysend?: boolean;
    dryRun?: boolean;
  }) {
    return this.call("send_payment", [{
      target_pubkey: params.targetPubkey,
      amount: params.amount,
      payment_hash: params.paymentHash || null,
      invoice: params.invoice || null,
      max_fee_amount: params.maxFeeAmount || null,
      max_parts: params.maxParts ? `0x${params.maxParts.toString(16)}` : null,
      keysend: params.keysend ?? false,
      dry_run: params.dryRun ?? false,
    }]);
  }

  // Info methods
  async nodeInfo() {
    return this.call("node_info");
  }

  async listChannels() {
    return this.call("list_channels");
  }

  async listPeers() {
    return this.call("list_peers");
  }
}

// Usage
const fiber = new FiberRpcClient("http://localhost:8227");
const info = await fiber.nodeInfo();
console.log("Node pubkey:", info.pubkey);

const payments = await fiber.listPayments(20, undefined, "Failed");
for (const p of payments.payments) {
  console.log(p.payment_hash, p.status, p.failed_error);
}
```

### Lens API Client

```typescript
// Use the Lens API for diagnostics
import { api } from "./lib/api-client";

// Analyze any payment
const report = await api.payments.analyze("0xabc123...");
console.log(report.category);      // "Liquidity Failure"
console.log(report.retryability);  // 92
console.log(report.recommendations);

// List failed payments with diagnostics
const { items } = await api.payments.list({ status: "Failed", limit: 10 });

// Get detailed investigation report
const full = await api.payments.get("0xabc123...");
console.log(full.routeAttempts[0].failingHop);  // 3
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `cargo: command not found` | Install Rust: https://rustup.rs |
| `FIBER_SECRET_KEY_PASSWORD` not set | Set it before starting: `export FIBER_SECRET_KEY_PASSWORD='pass'` |
| `Connection refused` on port 8227 | Fiber node isn't running — check `RUST_LOG=debug` output |
| `EADDRINUSE` on port 8228 | Another FNN instance is running — kill it first |
| RPC returns `Method not found` | Check method name spelling against the [RPC README](c:\Users\HP\Desktop\MY CODES\HACKATHONS\fiber\crates\fiber-lib\src\rpc\README.md) |
| Out of sync / no peers | Verify bootnodes are reachable; check firewall allows outbound 8228 |
| CKB RPC errors | Testnet CKB node may be down — the config uses `https://testnet.ckbapp.dev/` |
| Data corruption after upgrade | Run `fnn-migrate` (included in release) or `rm -rf fiber/store` and restart |

---

## Quick Start Summary

```bash
# 1. Clone & build
git clone https://github.com/nervosnetwork/fiber.git && cd fiber
cargo build --release

# 2. Setup
mkdir ~/fiber-testnet && cd ~/fiber-testnet
cp ../target/release/fnn . && cp ../config/testnet/config.yml .
mkdir ckb
# ... create ckb/key with your private key ...

# 3. Run
FIBER_SECRET_KEY_PASSWORD='demo123' RUST_LOG='info' ./fnn -c config.yml -d .

# 4. Test
curl -X POST http://localhost:8227 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"node_info","params":[]}'

# 5. Connect Lens
cd Fibre-Lens/backend
set FIBER_RPC_URL=http://localhost:8227
npm run dev
```
