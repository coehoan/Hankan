<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deployment policy

The user requires an explicit request to deploy before any release. Routine changes authorize local edits, local database migrations and local verification only. Do not push `dev` (it automatically deploys on Vercel), invoke a deployment, or apply Supabase cloud migrations until the user explicitly asks to deploy. Do not disable or change the existing Git deployment configuration without a separate request. Preserve `.env.local` and use the local test database for integration verification.
