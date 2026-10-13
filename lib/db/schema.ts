import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  real,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const shows = pgTable("shows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  platform: varchar("platform", { length: 20 }).notNull(), // 'youtube' | 'rss'
  youtubeChannelId: text("youtube_channel_id"),
  youtubeHandle: text("youtube_handle"),
  rssUrl: text("rss_url"),
  active: boolean("active").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  showId: integer("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  sourceType: varchar("source_type", { length: 40 }).notNull(), // youtube_transcript | youtube_description_only | rss_description
  rawText: text("raw_text").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  viewCount: integer("view_count"), // raw YouTube statistics.viewCount; null for RSS or failed fetch
  viewRatio: real("view_ratio"), // viewCount / show's trailing-6-month average viewCount; null = no engagement signal
});

export const episodeEntities = pgTable("episode_entities", {
  id: serial("id").primaryKey(),
  episodeId: integer("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // guest | topic | sponsor
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  mentionType: varchar("mention_type", { length: 20 }), // ad_read | mention | null
  excerpt: text("excerpt"),
  confidence: real("confidence").notNull().default(0.5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyBriefs = pgTable("weekly_briefs", {
  id: serial("id").primaryKey(),
  weekStartDate: date("week_start_date").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("running"), // success | partial | failed | running
  details: jsonb("details").notNull().default({}),
});

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 20 }).notNull(), // guest | sponsor
    topic: text("topic").notNull(),
    suggestions: jsonb("suggestions").notNull(), // [{ name, reason, sourceUrl? }]
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kindTopicUnique: uniqueIndex("ai_suggestions_kind_topic_unique").on(table.kind, table.topic),
  })
);

export const inviteDrafts = pgTable("invite_drafts", {
  id: serial("id").primaryKey(),
  guestValue: text("guest_value").notNull(),
  topicValue: text("topic_value"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | sent
  evidenceEpisodeId: integer("evidence_episode_id").references(() => episodes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const interviewPrepDrafts = pgTable("interview_prep_drafts", {
  id: serial("id").primaryKey(),
  topicValue: text("topic_value").notNull(),
  guestValue: text("guest_value").notNull(),
  guestSource: varchar("guest_source", { length: 20 }).notNull(), // proven | suggested
  questions: jsonb("questions").notNull(), // string[]
  script: text("script").notNull(),
  evidenceEpisodeId: integer("evidence_episode_id").references(() => episodes.id, { onDelete: "set null" }),
  // Step A/B of the differentiated-prep flow (Phase 1.2): coveredQuestions is what the ecosystem
  // already asked this guest (evidence, from transcripts); whiteSpace is Gemini's suggested
  // complement — null when the guest has no monitored-show transcript history to diff against.
  coveredQuestions: jsonb("covered_questions"), // { text, episodeId, excerpt }[] | null
  whiteSpace: jsonb("white_space"), // { question, why }[] | null
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guestProfiles = pgTable("guest_profiles", {
  id: serial("id").primaryKey(),
  normalizedGuest: text("normalized_guest").notNull().unique(),
  displayName: text("display_name").notNull(),
  verdict: varchar("verdict", { length: 20 }).notNull(), // oversaturated | wait | book_now | warm_lead
  repetitionScore: real("repetition_score"), // 0-1, null = "repetition not assessed"
  velocity30d: integer("velocity_30d").notNull(),
  appearances90d: integer("appearances_90d").notNull(),
  distinctShows30d: integer("distinct_shows_30d").notNull(),
  distinctShows6m: integer("distinct_shows_6m").notNull(),
  daysSinceLast: integer("days_since_last").notNull(),
  nextWindowDate: date("next_window_date"), // set only for "wait" verdict
  repeatedStories: jsonb("repeated_stories").notNull().default([]), // { story, episodeIds }[]
  freshMaterial: jsonb("fresh_material").notNull().default([]), // { point, episodeId }[]
  inputHash: text("input_hash").notNull(), // hash of sorted episode ids feeding this profile; skip recompute when unchanged
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const topicLifecycle = pgTable("topic_lifecycle", {
  id: serial("id").primaryKey(),
  normalizedTopic: text("normalized_topic").notNull().unique(),
  displayName: text("display_name").notNull(),
  // insufficient_data | emerging | peaking | evergreen | fading | mixed (rules are exhaustive
  // over the first five per spec; mixed is the deterministic catch-all for anything that
  // matches none of them, so the UI always has something defensible to render).
  classification: varchar("classification", { length: 20 }).notNull(),
  spreadB1: integer("spread_b1").notNull(), // distinct shows, oldest 30-day bucket of the trailing 90 days
  spreadB2: integer("spread_b2").notNull(),
  spreadB3: integer("spread_b3").notNull(), // newest 30-day bucket
  avgRatioB1: real("avg_ratio_b1"), // null when no episode in that bucket carries a viewRatio
  avgRatioB2: real("avg_ratio_b2"),
  avgRatioB3: real("avg_ratio_b3"),
  spreadTrend: integer("spread_trend").notNull(), // spread(B3) - spread(B1)
  performanceTrend: real("performance_trend"), // avgRatio(B3) - avgRatio(B1); null if either side has no ratio data
  counterAngles: jsonb("counter_angles").notNull().default([]), // { angle, rationale }[], only populated for Peaking
  inputHash: text("input_hash").notNull(), // hash of sorted episode ids in the trailing-90-day window; gates the counter-angle AI call
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
