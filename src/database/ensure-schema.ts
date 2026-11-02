import { sql } from "drizzle-orm";
import { db } from "@/database/connection";

const statements = [
  `CREATE TABLE IF NOT EXISTS "guild_user_stats" (
    "id" serial PRIMARY KEY NOT NULL,
    "guild_id" varchar(255) NOT NULL,
    "user_id" varchar(255) NOT NULL,
    "nickname" varchar(100),
    "minutes_listened" integer DEFAULT 0 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "guilds" (
    "guild_id" varchar(255) PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "icon_url" text,
    "member_count" integer,
    "owner_id" varchar(255),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "listening_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "guild_id" varchar(255) NOT NULL,
    "user_id" varchar(255) NOT NULL,
    "station_id" integer NOT NULL,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "finished_at" timestamp,
    "duration_minutes" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "stations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "url" text NOT NULL,
    "description" text,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "stations_name_unique" UNIQUE("name")
  )`,
  `CREATE TABLE IF NOT EXISTS "user_profiles" (
    "user_id" varchar(255) PRIMARY KEY NOT NULL,
    "username" varchar(100),
    "display_name" varchar(100),
    "avatar_url" text,
    "total_minutes_listened" integer DEFAULT 0 NOT NULL,
    "current_level" integer DEFAULT 1 NOT NULL,
    "total_xp" integer DEFAULT 0 NOT NULL,
    "last_active" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
];

export async function ensureSchema(): Promise<void> {
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
