import { db } from "../db";
import { guestProfiles, topicLifecycle, alertsSent } from "../db/schema";
import { eq, gte } from "drizzle-orm";
import { computeMoneyMap } from "../stats/money-map";
import { normalize } from "../ingest/normalize";

const DEDUPE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type AlertKind = "guest_book_now" | "brand_new_entrant" | "topic_emerging";

export type TrippedAlert = {
  kind: AlertKind;
  subjectKey: string;
  displayName: string;
  detail: string;
  evidenceUrl: string | null;
};

// No AI involved — alerts fire off deterministic cache-table/money-map state, same posture as
// the rest of the rules-based scoring (spec 4.2). "Newly tripped" is defined entirely by the
// absence of an alerts_sent row for (kind, subjectKey) in the trailing 14 days; the caller is
// expected to write that row back via recordAlertsSent() once the email actually sends.
export async function evaluateAlerts(): Promise<TrippedAlert[]> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const recentAlerts = await db.select().from(alertsSent).where(gte(alertsSent.trippedAt, since));
  const recentKeys = new Set(recentAlerts.map((a) => `${a.kind}:${a.subjectKey}`));

  const candidates: TrippedAlert[] = [];

  const bookNowGuests = await db.select().from(guestProfiles).where(eq(guestProfiles.verdict, "book_now"));
  for (const g of bookNowGuests) {
    candidates.push({
      kind: "guest_book_now",
      subjectKey: g.normalizedGuest,
      displayName: g.displayName,
      detail: `${g.displayName} just hit Book now — ${g.distinctShows6m} shows in 6 months, repetition score ${g.repetitionScore ?? "n/a"}.`,
      evidenceUrl: null,
    });
  }

  const emergingTopics = await db.select().from(topicLifecycle).where(eq(topicLifecycle.classification, "emerging"));
  for (const t of emergingTopics) {
    candidates.push({
      kind: "topic_emerging",
      subjectKey: t.normalizedTopic,
      displayName: t.displayName,
      detail: `"${t.displayName}" just flipped to Emerging — spread went ${t.spreadB1} to ${t.spreadB3} shows over the trailing 90 days.`,
      evidenceUrl: null,
    });
  }

  const moneyMap = await computeMoneyMap();
  for (const b of moneyMap.newEntrants) {
    candidates.push({
      kind: "brand_new_entrant",
      subjectKey: normalize(b.value),
      displayName: b.value,
      detail: `${b.value} just became a New entrant — ${b.recentAdReadCount} ad read(s) on ${b.recentShowCount} show(s) in the last 30 days.`,
      evidenceUrl: b.evidence[0]?.episodeUrl ?? null,
    });
  }

  return candidates.filter((c) => !recentKeys.has(`${c.kind}:${c.subjectKey}`));
}

export async function recordAlertsSent(alerts: TrippedAlert[], briefWindow: string): Promise<void> {
  if (alerts.length === 0) return;
  await db.insert(alertsSent).values(alerts.map((a) => ({ kind: a.kind, subjectKey: a.subjectKey, briefWindow })));
}
