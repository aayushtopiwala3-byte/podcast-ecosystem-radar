This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## AI Compliance

Every AI call in this codebase goes through [`lib/ai/gemini-flash.ts`](lib/ai/gemini-flash.ts), which is pinned to a single exact model id (`PINNED_MODEL`, currently `google/gemini-3.8-flash`) and routed through OpenRouter. No call site may parameterize or default to a different model — `chatCompletion`'s options type has no `model` field, and the client throws if OpenRouter's response reports back a different model than the one pinned, so a silent reroute fails loudly instead of quietly changing behavior or billing.

The resolved model id is recorded on every pipeline run (`pipeline_runs.details.model`) and surfaced in the Source Health UI (`/sources`) so the model actually used is independently verifiable, not just asserted in code.

Guest burn-score profiles and topic lifecycle classifications are cached in their own tables (`guest_profiles`, `topic_lifecycle`), each keyed by a content hash of the episode ids feeding the profile (`input_hash`). Recompute is skipped whenever the hash is unchanged, so the daily cron doesn't re-spend on AI calls for data it already analyzed.

An optional `AI_COST_CEILING_USD` env var caps spend on `/api/cron/daily-watch`: ingestion always runs, but the two AI-driven analysis stages (guest profiles, topic lifecycles) are skipped once cumulative cost for the run crosses the ceiling, and the triggering pipeline run is marked `partial` in `pipeline_runs`. Leave it unset to run without a ceiling.

## Daily Watch & Own Show Gaps

`/api/cron/daily-watch` runs incremental ingestion (shows not fetched in the last 24h) plus the cached AI analyses, then checks for newsworthy state changes — a guest newly hitting "Book now", a topic newly flipping to "Emerging", a brand newly becoming a "New entrant". A dedup record is written to `alerts_sent` per `(kind, subject)` so the same trip doesn't re-fire within 14 days; an alert email only sends when something new tripped.

Flagging a show `is_own_show` in Admin (exactly one at a time) turns on the "Own Show Gaps" section of the weekly brief — topics/guests/sponsors the rest of the monitored ecosystem has and the flagged show doesn't, plus topics the flagged show covered before anyone else did. With no show flagged, the section renders an explicit "not configured" empty state rather than guessing.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
