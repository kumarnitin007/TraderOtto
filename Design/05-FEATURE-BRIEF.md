# Trader Otto — Feature Brief (current product)

**Audience:** product reviewers, other AI tools, and marketing.  
**As of:** 16 Sep 2026  
**Product:** Trader Otto — a personal options trade journal with live marks, watchlists, alerts, and AI coaching.  
**Not:** a broker, a scanner, or a social trading app. It does not place orders.

Use this document as a single source of truth. If something is not listed here, treat it as not shipped.

---

## One-line pitch

Otto is the options journal that already knows your book: log a spread, watch live marks and assignment cash, get alerts before things break, and ask AI what to do next — without leaving the journal.

## Positioning

Retail options traders who sell defined-risk spreads (put/call credit spreads, iron condors, CSPs, covered calls) need three things brokers do not give them well:

1. A clean record of *what they actually traded*, not a blotter of fills.
2. A live view of *which open trades need attention*, using their own strikes, expiry, and marks.
3. Advice grounded in *their* history and *their* open book, not generic market commentary.

Otto is built for one trader, phone-first, with a laptop secondary. Dark Robinhood-inspired UI.

## Who it is for

- Solo options traders who journal credit/debit verticals, iron condors, CSPs, covered calls, strangles, and long options.
- People who already trade (often in Robinhood) and want a second screen that thinks in spreads, not stock.
- Traders who care about crash-case assignment cash, near-max profit, earnings, and expiry — not just P/L.

## Who it is not for

- Anyone who wants to place or hedge orders from the app.
- Professional OMS / multi-account desks.
- Stock-only or futures-only journals.
- Social copy-trading.

---

## Product map

Five screens:

| Screen | Job |
|---|---|
| **Positions** | Live book + watchlists. Decide what needs attention today. |
| **Log trade** | Capture a new or closed trade, including screenshot import. |
| **Performance** | Realized P/L, ROI, assignment cash backup, AI coach on closed trades. |
| **Alerts** | Inbox of Otto-generated signals. |
| **Settings** | Notification channels, quiet hours, mutes, delivery tests. |

Auth: email/password, magic link, Google OAuth, password reset. Data is user-scoped in Supabase. Demo/bypass mode is view-only.

---

## Shipped capabilities

### 1. Trade journal (core)

Supported strategies:

- Put Credit Spread, Call Credit Spread
- Put Debit Spread, Call Debit Spread
- Iron Condor (put + call strike pairs)
- Covered Call, Cash-Secured Put, Strangle
- Long Call, Long Put

Captured per trade: ticker, strategy, contracts, expiry, open date, strikes, stock at open, optional Greeks (IV, delta, sigma, theta), premium at open, notes. Close captures date, stock at close, premium to close.

P/L is strategy-aware: credits profit as the mark falls; debits profit as it rises. ROI and annualized ROI use capital-at-risk (spread width minus credit, CSP notional, share basis for covered calls, debit paid for longs).

### 2. Positions — live book

- Open rows with live underlying quotes and live option-spread marks (Alpaca snapshots, quote fallback, cached last-good marks).
- Pace badges: Near max / Exceptional / Strong / Ahead vs Watch / Underwater / Critical, based on % of premium captured vs time used.
- Focus filters: Focus (near strike, time decay, or losing), Near ±20%, ≤50% time left, Losing, All.
- Expand a row for open snapshot, live mark, and close workflow.
- Ticker drawer: company, fundamentals, analyst view, news, corporate actions (Finnhub).
- Tabbed watchlists beside the book (named groups of tickers with optional price bands, sector, earnings, notes).

### 3. Watchlists

- Multiple named lists.
- Per-ticker lower/upper price triggers.
- Cached next-earnings dates.
- Local Otto flags: range breach, unusual volume vs 20-day average, earnings within 30 days, price vs SMA20/SMA50.
- Otto candidate research (Ask Otto): ranks setups, suggests strategy *families* (not invented strikes), flags correlated names, lists names to avoid.

### 4. Fast capture

- Manual log form with live quote fill.
- Robinhood screenshot OCR (Tesseract) to prefill a trade; closed-screenshot import on Positions with duplicate detection. The parser recognizes verticals, strangles, and four-leg iron-condor strikes when the OCR text exposes them, plus stock/Greek fields when present.
- Edit and delete existing trades.
- Optional opening/closing fees (total dollars) feed net P/L.
- First-class close reasons: Closed, Expired, Assigned, Rolled.
- “Close & draft roll” closes the old leg and prefills a linked replacement trade. Roll links live in trade details without a database migration.

### 5. Performance

- Realized P/L: all-time / month / week, plus optional unrealized from live marks.
- Header realized P/L with range picker: this month, YTD, last 12 months, 5 years, all time.
- Weekly/monthly P/L bars.
- Closed-trade list with $ P/L, ROI, and annualized ROI.
- By-ticker breakdown (early vs held-to-expiry, average hold).
- One persisted P/L window drives the header, Performance bars/lists/ticker view, and Performance AI: this month, YTD, last 12 months, 5 years, all time. Weekly/monthly remains a grouping choice.
- Complete journal CSV export (open + closed rows, P/L, ROI, Greeks, fees, close reason, and roll links).
- **Assignment cash (backup):** cash needed to take assignment on short puts. A 200/190 put credit spread and a 200 CSP both count as $20,000 per contract. The same total appears on Positions and Performance; each eligible expanded position shows its own amount. Call-side and covered-call assignment is excluded.

### 6. Alerts

Event types:

- Watchlist price range crossed
- Position risk (Underwater / Critical)
- Near max profit (≥90% of premium)
- Expiry soon (configurable days)
- Earnings soon (configurable days)
- Assignment cash exceeds the trader’s configured dollar limit (disabled until a limit is set and the event is enabled)

Channels: in-app inbox (archive or remove from view), browser push, email (SendGrid; verify a Single Sender, then any user Delivery email works), Discord webhook, Telegram. Quiet hours and per-ticker / per-list mutes. Test-send from Settings does not enable a channel for live alerts; each event type has its own channel checkboxes, plus “Use for live alerts”. Telegram uses one shared bot; users pair a private chat (recommended) or add the bot as a channel admin with Post messages, then Otto fills the chat ID.

### 7. AI (OpenAI via existing quotes API — one serverless route)

Three distinct coaches, all persisted as structured JSON in `tr_api_events` (not chat transcripts). In the UI every entry point is branded **Ask Otto** (running state “Otto is thinking…”, rerun state “Ask Otto again”):

| Coach | Input | Output emphasis |
|---|---|---|
| **Portfolio summary** (open positions) | Open book + live marks + volume/MAs + cached earnings/sector + web search | Catalysts, hold/watch/reduce/close/roll, hidden concentration, pricing, crash scenarios, verify claims |
| **Watchlist research** | List tickers + quotes + technicals + web search | Ranked candidates, entry/invalidation, strategy family, avoid list |
| **Performance coach** (closed trades) | Closed journal in a chosen window (default last 12 months) | Review / next-trade ideas / process rules. Ideas must fit demonstrated style; no invented strikes or IV |

Performance coach duration: This month, YTD, Last 12 months (default), 5 years, All time. Three question buttons. Manual prompt preview remains available on all three coaches.

Portfolio reports offer three on-screen layouts (Action plan, Risk board, Full detail); the choice persists locally. All schema fields are shown, including deadlines, catalyst notes, mispricing, and verification items.

All three coaches expose saved report history (up to the latest 10 in the current context) without another paid call. Performance refresh compares the new answer with the previously viewed answer and summarizes changed conclusions, candidates, process priorities, and sample size. Performance trade ideas include **Prefill a trade draft**, which carries ticker, mapped strategy family, setup, trigger, invalidation, risk, and source to Log trade while leaving strikes/expiry/premium for the user.

**AI constraints (product truth, use in marketing carefully):**

- Decision support, not an instruction to trade.
- Does not invent option chain details (strikes, bid/ask, IV rank, expected move).
- Performance review/coaching skips web search; trade-idea mode uses it.
- Saved history is scoped by coach, watchlist, or Performance mode+range. The UI loads 10 reports; older successful rows remain in the database until retention removes them.

### 8. Market data stack

- Alpaca: stock quotes, option snapshots/quotes, clock/session, SMA20/SMA50, volume ratio, VWAP.
- Finnhub: company, fundamentals, news, earnings, analyst, corporate actions.
- Session-aware live polling; last-good snapshot cached per user so marks survive off-hours.

### 9. Themes and device

- Dark default and Warm Paper theme.
- Mobile bottom nav + desktop sidebar.
- Screen options (tabs, filters, P/L range) persist in localStorage.

---

## Explicit non-goals (still true)

- No order routing, no brokerage login for trading, no “one click close.”
- No multi-user sharing or leaderboards.
- No full options chain browser / volatility surface.
- No tax lot engine, wash-sale, or 1099 export.
- Recorded opening/closing fees reduce P/L. Unrecorded broker fees, cash interest, taxes, and stock P/L after assignment are not inferred.

---

## Recently shipped continuity and risk pack

The former seven recommendations are now implemented:

1. AI history for Portfolio, Watchlist, and Performance.
2. Performance “what changed” after refresh plus idea-to-journal prefill.
3. Assignment cash on Positions and a configurable book-limit alert.
4. Persisted Portfolio AI layout.
5. Improved multi-leg screenshot parsing.
6. Fees, close reasons, and linked roll drafts.
7. One performance window plus complete-journal CSV export.

### Suggested next feature

**Plan vs outcome.** Capture a short thesis, profit target, stop/adjustment trigger, and intended DTE when opening a trade. On close, ask whether the plan was followed and why it changed. Performance AI can then distinguish a bad process from a reasonable plan that lost, instead of inferring intent from prices alone.

---

## Existing features that need refinement

Ranked by user impact vs effort:

1. **Screenshot OCR confidence** — recognition is broader, but Robinhood layouts vary. Add field-level confidence and editable four-leg review rather than trusting any uncertain amount.
2. **Roll-chain analytics** — links now exist, but Performance still scores each leg separately. Add chain-level net P/L and days deployed.
3. **Assignment accounting** — close reason exists, but post-assignment shares and later stock sale are outside the options P/L model.
4. **AI delta breadth** — Performance has a semantic change summary; Portfolio and Watchlist currently offer history without their own change panel.
5. **Alert quality** — assignment limit is added; “AI said reduce and the risk worsened” remains unbuilt.
6. **Open book excluded from Performance AI** — intentional; a mode combining historical style with current exposure could prevent contradictory advice.
7. **Greeks at open** — OCR uses them when present and live positions refresh them, but Log trade still does not auto-price the selected option legs before save.
8. **Watchlist AI vs Positions AI overlap** — both can discuss the same ticker without shared cross-coach memory.

---

## Competitive frame (for marketing and reviewers)

| Capability | Typical broker app | Typical journal spreadsheet | Otto |
|---|---|---|---|
| Log a vertical / condor as one trade | Weak / multi-leg clutter | Manual | Native |
| Live spread mark vs time-in-trade | Positions, not journal logic | No | Pace badges |
| Crash assignment cash for short puts | Margin number, opaque | DIY | Explicit $ backup |
| Earnings + watchlist bands | Separate tools | DIY | Lists + alerts |
| Advice on *this* book | Generic news | None | Structured AI with citations/verify |
| Place the trade | Yes | No | **No (intentional)** |

Do not claim: “AI picks winning trades,” “replaces a broker,” “guaranteed max-loss,” or “real-time chain scanner.”

Safe claims:

- Journals defined-risk options the way you trade them.
- Shows which open spreads are ahead of schedule or in trouble.
- Tells you the cash you may need if short puts are assigned.
- Alerts on risk, expiry, earnings, and watch prices.
- AI reviews the open book, the watchlist, and your closed-trade style — with sources to verify.

---

## Marketing campaign seeds

**Name lockup:** Trader Otto  
**Category:** Options journal with a coach  
**Primary CTA:** Journal the spread. Otto watches the rest.  
**Secondary CTA:** See assignment cash before the crash, not after.

Campaign pillars (one idea per asset):

1. **“A 200/190 is $20,000, not $1,000.”** Visual of assignment cash vs max loss. Audience: credit-spread sellers.
2. **“Near max at day 8 of 45.”** Pace badge story. Audience: people who overstay winners.
3. **“Paste the Robinhood screenshot. Otto fills the journal.”** Capture speed.
4. **“What should I change?”** Performance coach on the user’s own closed trades.
5. **“Verify before you act.”** Show the verify section — honesty as a brand.
6. **“What changed since last time?”** Saved AI history and refresh delta.
7. **“From idea to journal, not idea to order.”** Safe prefilled draft with the trader choosing the actual contract.

Channels: short screen recordings (iPhone), Twitter/X threads for spread sellers, Reddit r/options (educational, not signal-selling), landing page with three screenshots: Positions focus, Assignment cash, AI action plan.

Proof points to film: live mark + badge, assignment total, AI report with source links, alert on underwater, screenshot import.

---

## Prompt for another AI (copy below)

```
You are reviewing Trader Otto, a personal options trade journal (not a broker).
Read the attached feature brief as the source of truth for what is shipped vs not.

Tasks:
1. Critique the product: gaps, confusing mental models, and what would make a credit-spread seller pay or stay.
2. Critique “Plan vs outcome” as the next feature and propose a tighter MVP or a better alternative.
3. Flag any marketing claims in the brief that overreach given the non-goals.
4. Draft 5 campaign headlines and 5 landing-page bullets that stay inside shipped capabilities.
5. List 10 user-test tasks for an iPhone walkthrough of the current app.

Do not invent features. If the brief is silent, assume it is not built.
```

---

## Technical snapshot (for AI implementers, not ads)

- Next.js 15 App Router, React 19, TypeScript, Tailwind, Vercel.
- Supabase Auth + Postgres (`tr_trades`, `tr_groups`, `tr_profiles`, `tr_api_events`, notifications).
- Market: Alpaca (server-side) + Finnhub.
- AI: OpenAI Responses API, JSON schema, optional web_search, stored in `tr_api_events`.
- OCR: Tesseract.js in the browser for Robinhood screenshots.
- Single AI serverless surface: `POST /api/quotes` with `action` = `portfolio_summary` | `watchlist_summary` | `performance_review` | `performance_trade_ideas` | `performance_coach`. Do not add a new Vercel function for another coach unless product requires it.
