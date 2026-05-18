import { mkdir } from "node:fs/promises";
import path from "node:path";

export const storageRoot = process.env.PDFFORGE_STORAGE_DIR ?? path.join(process.cwd(), "storage");
export const uploadDir = path.join(storageRoot, "uploads");
export const outputDir = path.join(storageRoot, "outputs");
export const databasePath = process.env.DATABASE_URL?.replace("file:", "") ?? path.join(storageRoot, "pdf-forge.sqlite");

export async function ensureStorage() {
  await Promise.all([mkdir(uploadDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);
}
