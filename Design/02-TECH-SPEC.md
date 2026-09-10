# Trader Otto — Technical Spec

## Stack

- **Next.js 14+ (App Router), TypeScript, Tailwind CSS** — deploys cleanly to Vercel
  with zero config.
- **State/data**: local, behind a repository interface (see below). No Redux/Zustand
  needed at this size — React Context + a small reducer is enough.
- **Icons**: `lucide-react`.
- **Deployment**: Vercel, connected to the git repo. Preview deploy per PR,
  production on `main`.

Init command:
```bash
npx create-next-app@latest trader-otto --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

## Phase 1: local cache (build this first)

Goal: a fully working, good-looking app with **no backend**. Data lives in the
browser only.

- Define the shape once, in `src/types/trade.ts`, matching the Supabase schema in
  `supabase/schema.sql` field-for-field (so Phase 2 is a data-layer swap, not a
  UI rewrite).
- Define a repository interface in `src/lib/data/tradeRepository.ts`:
  ```ts
  export interface TradeRepository {
    list(): Promise<Trade[]>;
    add(trade: NewTrade): Promise<Trade>;
    close(id: string, closePayload: ClosePayload): Promise<Trade>;
  }
  ```
- Implement it in `src/lib/data/localTradeRepository.ts` backed by `localStorage`
  (JSON blob, key `trader-otto:trades`). Seed it with a few sample trades on first
  load so the app isn't empty.
- Every component reads/writes through the repository (e.g. via a `useTrades()`
  hook that wraps it in React state) — **never** call `localStorage` directly from
  a component. This is the one rule that makes Phase 2 painless.
- Persist across reloads, but this is explicitly *not* multi-device — that's what
  Supabase is for.

## Phase 2: Supabase (do this once the UI is solid)

- Add `@supabase/supabase-js` and `@supabase/ssr`.
- Auth: Supabase Auth, email/password or magic link — simplest that gives a
  `user_id` to scope rows to.
- Run `supabase/schema.sql` (already scoped to `auth.users` with row-level security).
- Add `src/lib/data/supabaseTradeRepository.ts` implementing the same
  `TradeRepository` interface. Swap the implementation used by `useTrades()` behind
  a single flag/env var. UI components should require zero changes.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Live quotes: Alpaca, via a server route (not from the browser)

Alpaca calls need an API key + secret in headers — those can never ship to the
client, and Alpaca's data endpoints aren't meant to be hit directly from a browser
anyway. Proxy through a Next.js Route Handler:

```
src/app/api/quote/[symbol]/route.ts
```
```ts
export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  const res = await fetch(
    `${process.env.ALPACA_DATA_URL}/v2/stocks/${params.symbol}/trades/latest`,
    {
      headers: {
        "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID!,
        "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY!,
      },
      // avoid caching stale prices
      cache: "no-store",
    }
  );
  if (!res.ok) return Response.json({ error: "quote_failed" }, { status: 502 });
  const data = await res.json();
  return Response.json({ symbol: params.symbol, price: data.trade.p, ts: data.trade.t });
}
```

Env vars (set in Vercel project settings, not committed):
- `ALPACA_API_KEY_ID`
- `ALPACA_API_SECRET_KEY`
- `ALPACA_DATA_URL` — `https://data.alpaca.markets` for live, or the paper-equivalent
  data host if that's what the account uses.

The client's "Live price" button calls `/api/quote/AAPL` and fills the field from
the JSON response — same UX as the prototype's simulated version, just real.

For the auto-updating price on open positions in the Positions list, poll the same
route every few seconds (or switch to Alpaca's WebSocket stream later if it's worth
the complexity — REST polling is fine to start).

## Suggested folder structure

```
src/
  app/
    layout.tsx
    page.tsx                 # redirects to /positions or renders the shell
    positions/page.tsx
    log/page.tsx
    performance/page.tsx
    api/quote/[symbol]/route.ts
  components/
    nav/BottomNav.tsx
    nav/SideNav.tsx
    positions/TradeRow.tsx
    positions/TradeDetail.tsx
    log/TradeForm.tsx
    performance/PerformanceList.tsx
    ui/Pill.tsx
    ui/Tabs.tsx
  lib/
    data/tradeRepository.ts
    data/localTradeRepository.ts
    data/supabaseTradeRepository.ts   # phase 2
    pnl.ts                            # tradePnl, monthKey, weekKey helpers
  types/trade.ts
```

## Deployment

1. Push to GitHub, import the repo in Vercel.
2. Set env vars in Vercel → Project → Settings → Environment Variables
   (`ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, `ALPACA_DATA_URL`, and later the
   two Supabase vars). Phase 1 needs none of these to deploy successfully.
3. Every push to `main` auto-deploys to production; PRs get preview URLs — good for
   checking the mobile layout on an actual phone before merging.
