# Inventory Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three-second inventory polling with authorized Supabase Realtime invalidation.
**Architecture:** Private database broadcasts carry only invalidation signals. Clients debounce signals and reload through the existing authenticated API, preserving mutation and fridge isolation.
**Tech Stack:** Next.js, React, TypeScript, supabase-js 2.118.0, PostgreSQL, Vitest, pgTAP.
**Spec:** `docs/superpowers/specs/2026-10-29-inventory-realtime.md`

## Global Constraints

- No push, deployment, cloud DB mutation, DB reset, or new dependencies.
- Preserve pending thumbnail files and existing user data/environment files.
- Local-only migrations and integration fixtures. No polling fallback and no detailed broadcast payloads.

## Review Focus

- Signals during active reads/writes require a trailing refresh.
- Subscribing/reconnecting must close the initial-fetch/subscription gap.
- Hidden/offline/switch/unmount must reject stale callbacks and clean channels/timers.
- Nonmembers cannot subscribe; revoked users cannot obtain ingredient data.
- Connection errors must remain visible without triggering repeated GET requests.

### Task 1: Database broadcasts and authorization

**Files:** CLI-generated `supabase/migrations/*_inventory_realtime.sql`, `supabase/tests/015_inventory_realtime.test.sql`, `tests/integration/inventory-realtime.test.ts`.
**Interfaces:** private topic `fridge:<uuid>:inventory`, event `inventory_changed`, payload `{}`.

- [x] Write and run failing membership, send-permission, and trigger tests.
- [x] Create migration through Supabase CLI; implement private policy and restricted trigger function on ingredients and memberships.
- [x] Apply only pending local migrations; run DB tests and live two-client Broadcast integration, including outsider denial and excluded-member API denial.

### Task 2: Client event synchronization

**Files:** `src/features/inventory/inventory-realtime.ts`, its tests, `use-inventory.ts`, `inventory-screen.test.tsx`, affected shell test fixtures, `.agents/architecture.md`, `docs/operations.md`.
**Interfaces:** subscription adapter exposes change/status callbacks and cleanup; hook continues exposing existing mutation/refresh APIs.

- [x] Write failing tests for no polling, burst debounce, reconnect, in-flight invalidation, pause/cleanup, stale events, and revocation.
- [x] Replace timer with lifecycle-scoped private subscription and trailing invalidation refresh; expose connection failures using the existing error presentation.
- [x] Run unit/DB/integration, type, lint, format, build and local security checks appropriate to changes; document cloud migration prerequisite for later deployment.
- [x] Request one fresh code review and resolve important findings. Report local-only completion; do not deploy.

## Verification (2026-10-29)

- Unit: 264 passed. DB: 112 passed. Integration: 126 passed, 2 opt-in AI checks skipped.
- Typecheck, lint (3 existing warnings), changed-file format, build, git diff check passed. Local security advisor: no issues. Regenerated public database types match existing source after formatting.
- Actual local Realtime tested owner/member delivery for create/update/delete, empty application payload (protocol may add a random message UUID), outsider subscription denial, member removal invalidation, subsequent data denial, and resubscription.
- Single reviewer found one important race: a failed pending mutation could restore rows after logout. Added a failing regression, aborted pending writes on revocation, and guarded mutation rollback for revoked scopes. Reviewer's minor outsider-status assertion also added.
- Existing local DB/data preserved; started the previously missing local Realtime container without restarting the DB. Cloud/production untouched. Browser UI automation not performed because the existing origin denial remains in effect.
