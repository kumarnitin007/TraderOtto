# Trader Otto — Product Spec

## What it is

A personal options trade journal. One person logs the option spreads they've
traded, tracks them from open to close, and reviews weekly/monthly results.
Primary device is an iPhone; secondary is a laptop browser. Single-user for now
(one trader's own book), but the data model should be user-scoped from the start
since Phase 2 adds real auth.

## Core features

### 1. Log a trade
Capture, per trade:
- Ticker, strategy (Put Credit Spread, Call Credit Spread, Put Debit Spread,
  Call Debit Spread, Iron Condor, Covered Call, Cash-Secured Put, Strangle),
  number of contracts, expiry date, open date.
- Strikes: short strike / long strike. For Iron Condor, a second pair (call short
  / call long) appears automatically.
- Market snapshot at open: stock price, IV%, delta, sigma, theta.
- Premium collected at open ($ per contract).

### 2. Track and close positions
- Positions list, filterable Open / Closed / All.
- Tap a position to expand: see the full market snapshot from open, and (if open)
  a live mark price pulled from Alpaca.
- Closing a position captures: close date, stock price at close, premium paid to
  close. Realized P/L is computed as
  `(premium_open − premium_close) × contracts × 100`.

### 3. Performance
- Weekly and monthly views of realized P/L, each period showing total $ and trade
  count, plus overall win rate.
- Always-visible "this month" / "this week" numbers — the user should never have
  to dig for these.

## Non-goals (for now)

- No multi-leg Greeks modeling beyond what's manually entered — this is a journal,
  not a pricing engine.
- No brokerage order placement. Alpaca is used for **market data only** (current
  stock price), not trading.
- No multi-user sharing, teams, or social features.

## Design direction

Dark, Robinhood-inspired: true black background, green for gains/credits, red/orange
for losses/debits, flat divided lists rather than boxed cards, pill-shaped buttons,
one typeface. Full detail in `03-DESIGN-SYSTEM.md`, visual reference in
`reference/screenshots/`.
