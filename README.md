# Curio Collector

A collector app for cards, coins, comics, toys and everything else: scan an item, let Claude identify and value it, track your portfolio over time, keep a wishlist, and share a public showcase and feed.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, Storage, Row Level Security) · Vercel (hosting + cron) · Claude (identification and valuation) · eBay Browse API (asking-price cross-check)

## Features

- **Scan and identify.** Photo in, structured item out: name, category, year, maker, set, number, subject, variant, condition, grade, value range, match confidence and alternate matches. Review before saving.
- **Portfolio.** Total value, cost basis, unrealized and realized gain, value over time (1M to All), category breakdown, top items, 30-day movers.
- **Collection.** Search, filters (category, box, condition, graded/raw, owned/sold), sorting, grid and table views, bulk actions (eBay check, re-estimate, move, feature, delete).
- **Item detail.** Front and back photos, every field editable, value history chart, eBay asking prices with listing links, mark as sold, share to feed.
- **Wishlist.** Target prices with an at-or-under-target flag.
- **Profiles and feed.** Public profile with showcase (featured items) and optional full collection, follow collectors, posts with likes and comments.
- **CSV import and export.** Import maps common column names automatically.

## How Claude is used

Claude work runs in one of two places so a personal Claude plan can power it:

1. **Scanning in Claude.** The Curio scanner artifact on claude.ai identifies items on the user's own Claude plan and writes approved items to `scan_inbox` through the user's Supabase connector. The site moves inbox rows into the collection (uploading photos to Storage) the next time the user opens it.
2. **Nightly repricing in Claude.** A Claude scheduled task reads items due for repricing (older than 30 days), estimates values using Claude plus the stored eBay asking prices, writes them back, and logs each run in `reprice_runs`.

Users can also add their own Anthropic API key in Settings to scan and re-estimate directly on the site. The key stays in the browser and is sent straight to Anthropic.

## Pricing data

eBay restricted its sold-listings API (Marketplace Insights) to approved partners in 2026, so the app uses the public **Browse API** for current fixed-price asking prices. A Vercel cron (`/api/cron/comps`, daily) refreshes asking prices weekly per item. Asking prices run above sale prices, so they are a cross-check for Claude's estimate rather than the value itself.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | One per user; username, bio, privacy flags |
| `items` | Collection items, values, eBay asking stats, photos (Storage paths) |
| `value_history` | One point per item per day, written by trigger whenever `value` changes |
| `wishes` | Wishlist with target prices |
| `follows`, `posts`, `likes`, `comments` | Social features (`post_feed` and `profile_stats` views add counts) |
| `scan_inbox` | Items approved in the Claude scanner, waiting to be filed |
| `reprice_runs` | Log of nightly repricing runs, including token usage |

Every table uses Row Level Security. Items are visible to others only when the owner's profile is public and the item is featured or the whole collection is shared. Cron access goes through `security definer` functions that check a hashed shared secret, so no service-role key is deployed.

The full schema is in `supabase/schema.sql`.

## Running locally

```bash
cp .env.example .env.local   # fill in Supabase URL and anon key; eBay keys optional
npm install
npm run dev
```

## Environment variables

| Name | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | developer.ebay.com, Production application keys |
| `CRON_SECRET` | Random string; its SHA-256 is stored in `private.settings` |
| `NEXT_PUBLIC_CLAUDE_SCANNER_URL` | Optional link to the Claude scanner artifact |
