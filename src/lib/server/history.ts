import Database from "better-sqlite3";
import { desc } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { databasePath, ensureStorage } from "@/lib/server/paths";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  tool: text("tool").notNull(),
  inputName: text("input_name").notNull(),
  outputName: text("output_name").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
});

let db: ReturnType<typeof drizzle> | undefined;

export async function getDb() {
  if (!db) {
    await ensureStorage();
    const sqlite = new Database(databasePath);
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, tool TEXT NOT NULL, input_name TEXT NOT NULL, output_name TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)",
    );
    db = drizzle(sqlite);
  }
  return db;
}

export async function recordJob(job: typeof jobs.$inferInsert) {
  const database = await getDb();
  await database.insert(jobs).values(job);
}

export async function listJobs(limit = 25) {
  const database = await getDb();
  return database.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
}

export async function jobStats() {
  const rows = await listJobs(500);
  const totalJobs = rows.length;
  const successfulJobs = rows.filter((job) => job.status === "success").length;
  const totalBytes = rows.reduce((total, job) => total + job.size, 0);
  const byTool = rows.reduce<Record<string, number>>((acc, job) => {
    acc[job.tool] = (acc[job.tool] ?? 0) + 1;
    return acc;
  }, {});
  return { totalJobs, successfulJobs, totalBytes, byTool, recentJobs: rows.slice(0, 20) };
}
