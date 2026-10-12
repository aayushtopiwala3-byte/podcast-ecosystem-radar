import { runPipeline } from "./pipeline";
import { buildWeeklyBrief, saveWeeklyBrief } from "../brief/build";
import { sendWeeklyBriefEmail } from "../email/send-brief";
import { ensureSuggestions } from "../ai-suggestions";
import { getTopTopics } from "../stats/topic-performance";
import { db } from "../db";
import { weeklyBriefs } from "../db/schema";
import { eq } from "drizzle-orm";

export async function executeFullRun() {
  const pipelineResult = await runPipeline();

  const topTopics = await getTopTopics(5);
  await ensureSuggestions(topTopics.map((t) => t.tag));

  const briefPayload = await buildWeeklyBrief();
  const briefRow = await saveWeeklyBrief(briefPayload);

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendWeeklyBriefEmail(briefPayload);
    emailSent = true;
    await db.update(weeklyBriefs).set({ emailSent: true }).where(eq(weeklyBriefs.id, briefRow.id));
  } catch (err: any) {
    emailError = err?.message ?? String(err);
  }

  return {
    pipeline: pipelineResult,
    briefId: briefRow.id,
    emailSent,
    emailError,
  };
}
