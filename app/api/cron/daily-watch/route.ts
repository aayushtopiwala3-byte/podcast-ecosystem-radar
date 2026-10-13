import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/ingest/pipeline";
import { computeGuestProfiles } from "@/lib/guests/burn-score";
import { computeTopicLifecycles } from "@/lib/topics/lifecycle";
import { evaluateAlerts, recordAlertsSent } from "@/lib/alerts/evaluate";
import { sendAlertEmail } from "@/lib/email/send-alert";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Only re-fetch shows not already pulled by the Monday full run or a prior daily-watch
// invocation in the last day (spec 4.2) — ingestion here is strictly incremental.
const STALE_HOURS = 24;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secretParam = req.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  if (authHeader === `Bearer ${expected}`) return true;
  if (secretParam === expected) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ceiling = Number(process.env.AI_COST_CEILING_USD ?? "");
  const hasCeiling = Number.isFinite(ceiling) && ceiling > 0;

  try {
    const pipelineResult = await runPipeline({ onlyStaleHours: STALE_HOURS });
    let costSoFar = pipelineResult.aiUsage.costUsd;
    let ceilingHit = false;

    // Coarse-grained, stage-by-stage ceiling check (spec's governing architecture note) — cheap
    // ingestion always runs, the two expensive per-entity AI stages only run while under budget.
    let guestResult: Awaited<ReturnType<typeof computeGuestProfiles>> | null = null;
    if (!hasCeiling || costSoFar < ceiling) {
      guestResult = await computeGuestProfiles();
      costSoFar += guestResult.usage.reduce((sum, u) => sum + u.costUsd, 0);
    } else {
      ceilingHit = true;
    }

    let topicResult: Awaited<ReturnType<typeof computeTopicLifecycles>> | null = null;
    if (!hasCeiling || costSoFar < ceiling) {
      topicResult = await computeTopicLifecycles();
      costSoFar += topicResult.usage.reduce((sum, u) => sum + u.costUsd, 0);
    } else {
      ceilingHit = true;
    }

    if (ceilingHit && pipelineResult.status === "success") {
      await db.update(pipelineRuns).set({ status: "partial" }).where(eq(pipelineRuns.id, pipelineResult.runId));
    }

    // Money map is pure arithmetic (no AI), so it's always safe to evaluate regardless of the ceiling.
    const trippedAlerts = await evaluateAlerts();

    let emailSent = false;
    let emailError: string | null = null;
    if (trippedAlerts.length > 0) {
      try {
        await sendAlertEmail(trippedAlerts);
        emailSent = true;
        await recordAlertsSent(trippedAlerts, new Date().toISOString().slice(0, 10));
      } catch (err: any) {
        emailError = err?.message ?? String(err);
      }
    }

    return NextResponse.json({
      ok: true,
      pipeline: { runId: pipelineResult.runId, status: pipelineResult.status, outcomes: pipelineResult.outcomes },
      guestProfiles: guestResult,
      topicLifecycles: topicResult,
      costUsd: costSoFar,
      ceilingHit,
      alertsTripped: trippedAlerts.map((a) => ({ kind: a.kind, displayName: a.displayName })),
      alertEmailSent: emailSent,
      emailError,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
