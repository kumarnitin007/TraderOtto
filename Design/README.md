# Trader Otto — build kit for Cursor

This folder is everything you need to hand to Cursor to build **Trader Otto**, a
mobile-first options trade journal.

## What's in here

| File | Purpose |
|---|---|
| `01-PRD.md` | What the app does, who it's for, the three core features |
| `02-TECH-SPEC.md` | Stack, phased data layer (local cache → Supabase), Alpaca proxy, Vercel deploy |
| `03-DESIGN-SYSTEM.md` | Exact colors, type, spacing, component patterns |
| `04-CURSOR-BUILD-PLAN.md` | Step-by-step task list — paste this into Cursor first |
| `supabase/schema.sql` | The **final-state** database schema (not needed for phase 1, but build toward it) |
| `reference/component-reference.jsx` | A working prototype (inline-styled, not production code) — good for interaction logic, not for copy-pasting styles |
| `reference/screenshots/*.png` | Real renders of the prototype — the visual source of truth |

## How to use this with Cursor

1. Create a new Next.js project (see `02-TECH-SPEC.md` for the exact command).
2. Drop this whole `trader-otto-kit` folder into the repo root (e.g. as `/design/`).
3. Open Cursor in the repo, open `04-CURSOR-BUILD-PLAN.md`, and tell the agent:
   > "Follow `/design/04-CURSOR-BUILD-PLAN.md` step by step. Use `/design/03-DESIGN-SYSTEM.md`
   > for all colors/type/spacing, and match `/design/reference/screenshots/` for layout.
   > Read `/design/reference/component-reference.jsx` for behavior only — reimplement it with
   > Tailwind + TypeScript, don't copy the inline styles."
4. Work through the plan phase by phase. Don't let it jump to Supabase until Phase 1
   (local cache) is visually solid — that's intentional, it's how we scoped this.

## The two-phase data plan, in one sentence

Everything reads and writes through one `TradeRepository` interface from day one;
phase 1 implements it with `localStorage`, phase 2 swaps the implementation for
Supabase — the UI code never changes.
