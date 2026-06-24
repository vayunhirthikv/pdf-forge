import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const isVercel = process.env.VERCEL === "1";

export const storageRoot = isVercel ? path.join(os.tmpdir(), "pdfforge") : (process.env.PDFFORGE_STORAGE_DIR ?? path.join(process.cwd(), "storage"));
export const uploadDir = path.join(storageRoot, "uploads");
export const outputDir = path.join(storageRoot, "outputs");
export const databasePath = isVercel ? path.join(storageRoot, "pdf-forge.sqlite") : (process.env.DATABASE_URL?.replace("file:", "") ?? path.join(storageRoot, "pdf-forge.sqlite"));

export async function ensureStorage() {
  await Promise.all([mkdir(storageRoot, { recursive: true }), mkdir(uploadDir, { recursive: true }), mkdir(outputDir, { recursive: true }), mkdir(path.dirname(databasePath), { recursive: true })]);
}
