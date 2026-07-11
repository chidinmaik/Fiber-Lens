

# Fiber Lens Technical Discovery Report

Version: 0.1

Status: Active Research

Purpose: Living repository of all technical discoveries related to Fiber Network that may influence the design and implementation of Fiber Lens.

This document should be continuously updated as new findings are discovered.

It serves as the primary technical knowledge base for developers and AI agents working on the project.

---

# Introduction

The purpose of this document is not to describe the product.

The purpose of this document is to understand Fiber itself.

Every implementation decision should be based on actual Fiber capabilities rather than assumptions.

Whenever possible:

Use existing Fiber functionality.

Avoid rebuilding functionality already provided by Fiber.

The more native Fiber capabilities we leverage, the stronger the final project becomes.

---

# Research Goals

We are attempting to answer several questions.

1. What data does Fiber expose?
2. How are payments represented internally?
3. How are failures represented?
4. How are routes represented?
5. How much historical information is available?
6. Can failed payments be reconstructed?
7. What information is required for diagnostics?

---

# Repository Information

Repository:

https://github.com/nervosnetwork/fiber

Branch:

develop

Primary Investigation Focus:

* Payment System
* Routing System
* Event System
* Session Storage
* Error Handling

---

# Discovery Log

This section records findings in chronological order.

---

## Discovery 001

Payment RPC Module Exists

File:

crates/fiber-lib/src/rpc/payment.rs

Finding:

Fiber exposes payment-related RPC methods.

Impact:

Lens can integrate through existing RPC infrastructure.

Confidence:

Confirmed

---

# Confirmed RPC Methods

The following methods have been confirmed.

---

## send_payment

Purpose:

Initiate payment.

Observed Parameters:

* amount
* target_pubkey
* payment_hash
* invoice
* timeout
* max_fee_amount
* max_fee_rate
* max_parts
* hop_hints
* trampoline_hops
* dry_run

Potential Lens Use:

Capture payment execution requests.

---

## get_payment

Purpose:

Retrieve payment details.

Potential Lens Use:

Payment inspection.

---

## list_payments

Purpose:

Retrieve payment history.

Potential Lens Use:

Primary data source for MVP.

---

## build_router

Purpose:

Construct routes.

Potential Lens Use:

Future route analysis.

Potential Time Machine integration.

---

## send_payment_with_router

Purpose:

Send payment through user-defined route.

Potential Lens Use:

Advanced diagnostics.

Potential route replay functionality.

---

# Confirmed Payment Fields

The following fields were observed inside response structures.

---

## payment_hash

Purpose:

Unique payment identifier.

Status:

Confirmed

Usage:

Primary lookup key.

---

## status

Purpose:

Payment state tracking.

Status:

Confirmed

Open Question:

Need enum definition.

---

## created_at

Purpose:

Payment creation timestamp.

Status:

Confirmed

Usage:

Timeline reconstruction.

---

## last_updated_at

Purpose:

Payment update timestamp.

Status:

Confirmed

Usage:

Timeline reconstruction.

---

## fee

Purpose:

Payment fee tracking.

Status:

Confirmed

Usage:

Analytics and diagnostics.

---

## failed_error

Purpose:

Failure information.

Status:

Confirmed

Priority:

Critical

Reason:

This field is central to Lens.

---

# Payment Status Investigation

Current State

Confirmed:

PaymentStatus exists.

Observed:

fiber_types::PaymentStatus

Unknown:

Actual enum values.

Potential Examples:

* Pending
* Created
* InFlight
* Failed
* Succeeded

Action Required:

Locate definition.

Search Commands:

grep -R "enum PaymentStatus" .

grep -R "PaymentStatus" .

Priority:

Critical

---

# Failure Model Investigation

Current State

Confirmed:

failed_error exists.

Observed:

response.failed_error

Unknown:

Data structure.

Possibilities:

Option A

String

Example:

"Insufficient liquidity"

---

Option B

Enum

Example:

FailureReason::RouteNotFound

---

Option C

Structured Object

Example:

{
code,
message,
category
}

This is the most valuable possibility.

Reason:

Would significantly improve diagnostics.

Priority:

Highest

---

# Payment Session Investigation

Current State

Confirmed:

Payment sessions exist.

Observed:

get_payment_sessions_with_limit()

Implications:

Fiber stores historical payment information.

Potential Benefits:

* Historical analysis
* Trend analysis
* Timeline generation

Unknown:

Actual session schema.

Action:

Locate PaymentSession definition.

Priority:

High

---

# SendPaymentResponse Investigation

Current State

Confirmed:

SendPaymentResponse exists.

Observed:

Used throughout payment RPC flow.

Importance:

Likely primary source of diagnostic information.

Unknown:

Full structure.

Action:

Locate definition.

Search:

grep -R "struct SendPaymentResponse" .

Priority:

High

---

# Route Infrastructure Investigation

Current State

Confirmed:

build_router exists.

Confirmed:

send_payment_with_router exists.

Confirmed:

router objects exist.

Observed:

response.routers

Implications:

Fiber already contains route abstractions.

Potential Future Use Cases:

* Route diagnostics
* Route replay
* Route visualization
* Time Machine

Priority:

High

---

# Route Persistence Investigation

Question:

Does Fiber persist route information after execution?

Possible Outcomes

Outcome 1

Route information retained.

Impact:

Time Machine becomes easier.

---

Outcome 2

Route information discarded.

Impact:

Lens may need its own persistence layer.

Status:

Unknown

Priority:

High

---

# Event System Investigation

Question:

Does Fiber expose payment events?

Desired Events:

* PaymentCreated
* PaymentAttempted
* PaymentSucceeded
* PaymentFailed
* RouteSelected

Benefits:

Real-time diagnostics.

Improved timelines.

Streaming analytics.

Status:

Unknown

Action:

Search repository.

Priority:

Medium

---

# Storage Layer Investigation

Questions:

How are payments stored?

How are failures stored?

How long are records retained?

Can records be queried efficiently?

Status:

Unknown

Priority:

Medium

---

# Current Lens Integration Plan

Phase 1

Use existing Fiber RPC methods.

Primary Data Sources:

* list_payments
* get_payment

Avoid building custom collectors initially.

Reason:

Faster development.

Reduced complexity.

---

# Potential Data Pipeline

Fiber Node

↓

RPC Layer

↓

Payment Collector

↓

Normalization Layer

↓

Diagnostics Engine

↓

SQLite

↓

Dashboard

---

# Known Unknowns

The following discoveries are required before implementation can be finalized.

---

Priority 1

PaymentStatus definition

Reason:

Needed for state modeling.

---

Priority 2

failed_error structure

Reason:

Core diagnostic engine dependency.

---

Priority 3

SendPaymentResponse

Reason:

Potential source of rich metadata.

---

Priority 4

PaymentSession

Reason:

Historical analysis dependency.

---

Priority 5

Payment Event System

Reason:

Real-time observability.

---

Priority 6

Route Persistence

Reason:

Future Time Machine architecture.

---

# Architecture Decisions

Decision 001

Leverage Fiber APIs whenever possible.

Status:

Accepted

Reason:

Reduces implementation complexity.

---

Decision 002

Focus on diagnostics rather than payment execution.

Status:

Accepted

Reason:

Stronger alignment with hackathon goals.

---

Decision 003

Design data models with future Time Machine support in mind.

Status:

Accepted

Reason:

Avoid expensive future refactors.

---

# Risk Assessment

Current Technical Risk:

Low to Medium

Reason:

Research indicates Fiber already exposes:

* Payment APIs
* Payment history
* Payment status
* Failure tracking
* Route infrastructure

Most foundational capabilities appear to exist.

The primary remaining uncertainty is the richness of failure information available through Fiber.

---

# Current Conclusion

Research conducted so far suggests that Fiber Lens should focus on interpretation rather than infrastructure creation.

Fiber already appears to provide much of the data required for diagnostics.

The project's primary challenge is not collecting information.

The project's primary challenge is transforming information into actionable operational intelligence.

This discovery significantly strengthens the viability of Fiber Lens as a hackathon project.
