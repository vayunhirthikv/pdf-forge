import { writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { uploadDir } from "@/lib/server/paths";
import type { StoredFile } from "@/lib/server/process";

export const maxFileSize = Number(process.env.MAX_UPLOAD_MB ?? 200) * 1024 * 1024;

export async function persistUploads(files: File[]) {
  const written: StoredFile[] = [];
  for (const file of files) {
    if (file.size > maxFileSize) throw new Error(`${file.name} exceeds the upload limit.`);
    const id = nanoid();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const filePath = path.join(uploadDir, `${id}-${safeName}`);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    written.push({ path: filePath, name: file.name, type: file.type || "application/octet-stream", size: file.size });
  }
  return written;
}

export function resultHeaders(result: { name: string; type: string; meta?: Record<string, string | number | boolean> }, inputSize: number, outputSize: number) {
  const savedBytes = inputSize - outputSize;
  const savedPercent = inputSize > 0 ? Math.round((savedBytes / inputSize) * 1000) / 10 : 0;
  return {
    "Content-Type": result.type,
    "Content-Disposition": `attachment; filename="${result.name}"`,
    "Cache-Control": "no-store",
    "X-PDFForge-Meta": JSON.stringify({ ...result.meta, inputSize, outputSize, savedBytes, savedPercent }),
  };
}
