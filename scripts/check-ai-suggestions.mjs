import { config } from "dotenv";
config({ path: ".env.local" });
const { db } = await import("../lib/db/index.ts");
const { aiSuggestions } = await import("../lib/db/schema.ts");

const rows = await db.select().from(aiSuggestions);
console.log("ai_suggestions rows:", rows.length);
for (const r of rows) {
  console.log(`\n[${r.kind}] ${r.topic} (generated ${r.generatedAt})`);
  console.log(JSON.stringify(r.suggestions, null, 2));
}
