# Production Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One dev push runs verification, production build, pending DB migrations, then Vercel deployment.
**Architecture:** GitHub Actions serializes releases; a fail-fast Node orchestrator checks known targets and prebuilt output before migration and deployment. Existing Git dev auto deployments are disabled in repository config.
**Tech Stack:** GitHub Actions, Node24.15.0, pinned Supabase2.122.0 and Vercel65.7.0, native node:test.
**Spec:** `docs/superpowers/specs/2026-10-29-production-pipeline.md`

## Global Constraints

- Local files only: no push, cloud mutations, live deployment, secrets provisioning or production CLI commands.
- Preserve pending thumbnail/Realtime work, local data, .env.local and .env.test.local.
- Verification uses ephemeral loopback DB credentials; migration secrets do not enter app build/deploy commands.

## Review Focus

- Missing credentials, wrong repository/branch, and wrong project must block all production operations.
- Build failure/missing artifact/wrong pulled environment must block DB changes.
- Migration failure must block deployment, including dry-run/link failures.
- A failing deploy never reruns migrations automatically or resets DB data.
- Workflow must have no parallel Vercel Git path or secret-bearing test/artifact upload.

### Task 1: CI helpers and ordered release

Files: `scripts/ci-test-env.mjs`, `scripts/release-production.mjs`, `tests/ci/*.test.mjs`, `package.json`.

- [x] Write failing tests for target/credential fences, fail-fast commands, secret scoping and local-only test environment generation.
- [x] Implement deterministic helpers and prove green with injected commands/files only.

### Task 2: Wiring and operator instructions

Files: `.github/workflows/production.yml`, `vercel.json`, `docs/deployment-pipeline.md`, existing agent/operation docs.

- [x] Add pinned actions/tool versions, serial dev-only job, offline tests and explicit production release invocation.
- [x] Document exact GitHub Secrets/Variables values and their origins; clarify nothing is live until future authorized push.
- [x] Validate YAML, shell/script behavior, formatting, lint/type checks and existing regression scope; request one fresh final review and fix important issues.

## Verification

- Native node:test: 30 passed; initial tests failed for missing implementation. Failure scenarios cover each ordered production command, build metadata, target mismatch, missing credentials and child-process secret scope.
- actionlint1.7.12 validated the workflow (download checksum verified); Bash syntax-only validation passed. All repository formatting and lint passed with only 3 preexisting warnings. This task changed JS/YAML/docs and a package script, so existing application typecheck/build/DB/integration checks from the preceding Realtime task were not repeated.
- CI env helper accepted actual local Supabase status, generated the same public key in memory, omitted OpenAI configuration and left the user's test env file unchanged. Local release guard rejected execution outside GitHub Actions.
- Fresh reviewer: no confirmed findings. Pinned Vercel65.7.0 source was checked for production build/prebuilt flags and environment path compatibility.
- No production CLI, remote workflow, push, deployment, cloud migration, credentials provisioning or environment-file overwrite was performed. Actual GitHub hosted-runner verification requires later credential registration and an authorized push.
