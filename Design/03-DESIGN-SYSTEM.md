# Trader Otto — Design System

Robinhood-inspired dark UI. True black, one accent pair (green/red), one typeface,
flat divided lists over boxed cards, pill-shaped controls. See
`reference/screenshots/` for the real thing.

## Color

| Token | Hex | Use |
|---|---|---|
| `bg` | `#000000` | App background, true black |
| `surface` | `#111214` | Inputs, summary tiles, raised surfaces |
| `surfaceRaise` | `#18191C` | Hover/active surface state |
| `divider` | `#232529` | Hairlines between list rows, borders |
| `text` | `#FFFFFF` | Primary text |
| `textDim` | `#8A8D93` | Secondary text (strategy names, tab labels) |
| `textFaint` | `#55585E` | Tertiary text (meta info, placeholders) |
| `green` | `#00C805` | Gains, credits, positive P/L, primary CTA |
| `greenSoft` | `rgba(0,200,5,0.12)` | Positive pill background |
| `red` | `#FF5000` | Losses, debits, negative P/L |
| `redSoft` | `rgba(255,80,0,0.12)` | Negative pill background |

In Tailwind config, add these as custom colors (`otto-bg`, `otto-green`, etc.)
rather than reaching for Tailwind's default `green-500` — the exact Robinhood-style
hues matter for the feel.

## Typography

- **One family**: Inter, weights 400/500/600/700/800.
- `font-variant-numeric: tabular-nums` globally, so all dollar figures and strikes
  align in lists.
- Scale: big balance numbers 32–34px/800 weight; row titles 15px/700; body/labels
  13–14px/500; meta/captions 11–12px/400–500.
- No serif, no monospace, no all-caps body text. Section labels (e.g. "TRADE",
  "STRIKES & PREMIUM") are the one deliberate all-caps use — small, 700 weight,
  `textDim` color, letter-spacing ~0.4px.

## Layout patterns

- **Mobile (primary)**: single column, bottom tab bar (Positions / Log trade /
  Performance), icons + small labels, active tab in green.
- **Laptop (secondary, ≥860px)**: left sidebar nav replaces the bottom bar, main
  content gets more breathing room; positions render as a table instead of a
  stacked list.
- **Header**: big "All-time P/L" number up top, with two small pill chips below it
  for "This month" / "This week" — these two numbers should be visible without
  navigating anywhere.

## Components

- **List rows, not cards.** Positions and performance periods are flat rows
  separated by a 1px `divider` hairline — no background fill, no border-radius,
  no shadow on the row itself.
- **Avatars**: 34px circle, ticker's first two letters, background color picked
  deterministically from the ticker string (small fixed palette of 5 hues is fine).
- **Pills**: fully rounded (`border-radius: 999px`), used for the month/week P/L
  chips and for primary buttons ("Save trade", "Confirm close"). Primary pill =
  solid green background, black text, 700 weight.
- **Tabs**: underline style, not boxed segmented control — gray inactive text,
  white active text, 2px green underline. Used for Open/Closed/All and
  Weekly/Monthly.
- **Inputs**: no boxes. Transparent background, bottom border only
  (`1.5px solid divider`, turns green on focus), label above in `textDim` 12px.
  Textareas are the one exception — full border + rounded corners, since a bare
  underline doesn't read as a multi-line field.
- **Live indicator**: small 6px green dot with a slow pulse animation next to any
  "live" data source label (e.g. "Alpaca market data").
- **Bars for performance**: thin (6px), fully rounded, `surface` track with a
  green/red fill proportional to the period's P/L relative to the largest period
  in view.

## What to avoid

- No drop shadows, no gradients, no card borders around list rows.
- No secondary accent colors beyond green/red — status and meaning are always
  carried by that one pair.
- Don't reach for rounded rectangle "SaaS card" chrome anywhere; the Robinhood
  reference point is flat lists + pills + one bold number, not boxed dashboards.
