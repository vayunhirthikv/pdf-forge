import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { persistUploads } from "@/lib/server/files";
import { ensureStorage } from "@/lib/server/paths";
import { processPdfTool, type StoredFile } from "@/lib/server/process";
import { rateLimit } from "@/lib/server/rate-limit";
import { recordJob } from "@/lib/server/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowStep = {
  tool: string;
  options?: Record<string, string | number | boolean>;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`workflow:${ip}`, 10, 60_000)) return NextResponse.json({ error: "Too many workflow requests. Please wait a minute." }, { status: 429 });

  const written: StoredFile[] = [];
  const resultDirs = new Set<string>();
  const workflowTemp = await mkdtemp(path.join(os.tmpdir(), "pdfforge-workflow-"));

  try {
    await ensureStorage();
    const form = await request.formData();
    const steps = JSON.parse(String(form.get("steps") ?? "[]")) as WorkflowStep[];
    const files = form.getAll("files").filter((file): file is File => file instanceof File);
    if (!files.length) return NextResponse.json({ error: "Upload at least one file." }, { status: 400 });
    if (!steps.length) return NextResponse.json({ error: "Add at least one workflow step." }, { status: 400 });

    written.push(...(await persistUploads(files)));
    let current: StoredFile[] = written;
    const report: Array<Record<string, string | number | boolean>> = [];

    for (const [index, step] of steps.entries()) {
      const result = await processPdfTool(step.tool, current, step.options ?? {});
      resultDirs.add(path.dirname(result.path));
      const body = await readFile(result.path);
      const nextPath = path.join(workflowTemp, `${index + 1}-${result.name}`);
      await writeFile(nextPath, body);
      current = [{ path: nextPath, name: result.name, type: result.type, size: body.byteLength }];
      report.push({ step: index + 1, tool: step.tool, output: result.name, outputSize: body.byteLength, ...(result.meta ?? {}) });
    }

    const final = current[0];
    const body = await readFile(final.path);
    await recordJob({ id: nanoid(), tool: "workflow", inputName: written.map((file) => file.name).join(", "), outputName: final.name, size: body.byteLength, status: "success", createdAt: Date.now() });

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": final.type,
        "Content-Disposition": `attachment; filename="workflow-${final.name}"`,
        "Cache-Control": "no-store",
        "X-PDFForge-Meta": JSON.stringify({ steps: report }),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow failed." }, { status: 500 });
  } finally {
    await Promise.all(written.map((file) => rm(file.path, { force: true }).catch(() => undefined)));
    await Promise.all([...resultDirs].map((dir) => rm(dir, { recursive: true, force: true }).catch(() => undefined)));
    await rm(workflowTemp, { recursive: true, force: true }).catch(() => undefined);
  }
}
