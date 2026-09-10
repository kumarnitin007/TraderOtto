# Cursor build plan — Trader Otto

Work through these in order. Don't skip ahead to Supabase (step 8) until steps 1–7
are visually matching the screenshots — that's the intended scope for this pass.

Read first: `01-PRD.md`, `02-TECH-SPEC.md`, `03-DESIGN-SYSTEM.md`. Match layouts to
`reference/screenshots/`. Treat `reference/component-reference.jsx` as a behavior
reference only (state transitions, P/L math, form fields) — it's inline-styled
prototype code, not something to paste in; rebuild it with Tailwind + TypeScript
per the design system doc.

## Step 1 — Project scaffold
- `create-next-app` per the command in `02-TECH-SPEC.md`.
- Add `lucide-react`.
- Set up Tailwind theme colors/typography from `03-DESIGN-SYSTEM.md` in
  `tailwind.config.ts` (custom `otto-*` color tokens, Inter via `next/font/google`).
- Global layout: black background, white text, no default Next.js boilerplate.

## Step 2 — Types and the repository interface
- `src/types/trade.ts`: `Trade`, `NewTrade`, `ClosePayload` types matching
  `supabase/schema.sql` columns.
- `src/lib/data/tradeRepository.ts`: the `TradeRepository` interface from
  `02-TECH-SPEC.md`.
- `src/lib/pnl.ts`: `tradePnl(trade)`, `monthKey(date)`, `weekKey(date)` — port the
  logic from `component-reference.jsx`, it's already correct.

## Step 3 — Local cache repository
- `src/lib/data/localTradeRepository.ts`, backed by `localStorage`, seeded with a
  handful of sample trades on first run (reuse the seed data shape from
  `component-reference.jsx`).
- `src/hooks/useTrades.ts` — wraps the repository in React state, exposes
  `trades`, `addTrade`, `closeTrade`, `loading`.

## Step 4 — App shell and navigation
- Bottom tab bar (mobile) / left sidebar (≥860px), per `03-DESIGN-SYSTEM.md`.
- Three routes: `/positions`, `/log`, `/performance`.
- Shared header: "All-time P/L" big number + month/week pills, computed from
  `useTrades()`.

## Step 5 — Positions view
- Open/Closed/All underline tabs.
- Flat list rows: avatar, ticker + strategy, strikes/expiry/contracts meta line,
  right-aligned live price (or realized P/L if closed) with up/down indicator.
- Tap to expand: greeks/snapshot grid, and for open trades a "Close position" pill
  that reveals the close form (close date, close stock price, premium paid),
  confirming through `closeTrade()`.
- Desktop: same data as a table (see `desktop-01-positions.png`).

## Step 6 — Log trade form
- Sections: Trade / Strikes & Premium / Market Snapshot / Notes, matching
  `mobile-03-log-trade.png` and `desktop-02-log-trade.png`.
- Iron Condor strategy reveals the second (call) strike pair.
- Underline-style inputs per the design system, green pill submit button.
- On submit, calls `addTrade()` and routes to `/positions`.

## Step 7 — Performance view
- Weekly/Monthly underline toggle, three summary tiles (this month, this week, win
  rate), then a divided list of periods with a thin proportional bar + $ amount,
  per `mobile-04-performance.png` / `desktop-03-performance.png`.

## Step 8 — Alpaca live quotes (real, not simulated)
- Implement `src/app/api/quote/[symbol]/route.ts` exactly as in
  `02-TECH-SPEC.md`.
- "Live price" button in the Log Trade form and Close flow calls this route and
  fills the stock price field.
- Positions list polls the route every few seconds for tickers with open
  positions, to drive the live mark price + up/down indicator.
- Requires `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY` / `ALPACA_DATA_URL` in
  `.env.local` (get a free paper-trading key from Alpaca if you don't have one).

## Step 9 — Deploy phase 1 to Vercel
- Push to GitHub, import into Vercel, add the Alpaca env vars in project settings.
- Confirm the mobile layout on an actual phone via the preview URL before calling
  this phase done.

## Step 10 — Supabase migration (later phase, separate task)
- Create a Supabase project, run `supabase/schema.sql`.
- Add Supabase Auth (email/password or magic link) — simplest flow that yields a
  `user_id`.
- Implement `src/lib/data/supabaseTradeRepository.ts` against the same
  `TradeRepository` interface.
- Swap `useTrades()` to use it (env-flag or straight swap once confident).
- Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
- Verify RLS: a second test user should see zero trades from the first.
