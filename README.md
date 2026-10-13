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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
