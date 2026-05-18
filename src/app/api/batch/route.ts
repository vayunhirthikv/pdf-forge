import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { persistUploads } from "@/lib/server/files";
import { ensureStorage } from "@/lib/server/paths";
import { processPdfTool, type StoredFile } from "@/lib/server/process";
import { rateLimit } from "@/lib/server/rate-limit";
import { recordJob } from "@/lib/server/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`batch:${ip}`, 8, 60_000)) return NextResponse.json({ error: "Too many batch requests. Please wait a minute." }, { status: 429 });

  const written: StoredFile[] = [];
  const resultDirs = new Set<string>();

  try {
    await ensureStorage();
    const form = await request.formData();
    const tool = String(form.get("tool") ?? "");
    const options = JSON.parse(String(form.get("options") ?? "{}")) as Record<string, string | number | boolean>;
    const files = form.getAll("files").filter((file): file is File => file instanceof File);
    if (!files.length) return NextResponse.json({ error: "Upload at least one file." }, { status: 400 });

    written.push(...(await persistUploads(files)));
    const archive = new JSZip();
    const reports: Array<Record<string, string | number | boolean>> = [];

    for (const file of written) {
      const result = await processPdfTool(tool, [file], options);
      resultDirs.add(path.dirname(result.path));
      const body = await readFile(result.path);
      const outputName = `${path.parse(file.name).name}-${result.name}`;
      archive.file(outputName, body);
      reports.push({ input: file.name, output: outputName, inputSize: file.size, outputSize: body.byteLength, savedBytes: file.size - body.byteLength, ...(result.meta ?? {}) });
    }

    archive.file("batch-report.json", JSON.stringify(reports, null, 2));
    const body = await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await recordJob({ id: nanoid(), tool: `batch:${tool}`, inputName: `${written.length} files`, outputName: "batch-results.zip", size: body.byteLength, status: "success", createdAt: Date.now() });

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="batch-results.zip"`,
        "Cache-Control": "no-store",
        "X-PDFForge-Meta": JSON.stringify({ files: written.length, report: reports }),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Batch processing failed." }, { status: 500 });
  } finally {
    await Promise.all(written.map((file) => rm(file.path, { force: true }).catch(() => undefined)));
    await Promise.all([...resultDirs].map((dir) => rm(dir, { recursive: true, force: true }).catch(() => undefined)));
  }
}
