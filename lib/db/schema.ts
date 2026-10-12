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
