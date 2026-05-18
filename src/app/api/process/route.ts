import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { ensureStorage } from "@/lib/server/paths";
import { processPdfTool, type StoredFile } from "@/lib/server/process";
import { rateLimit } from "@/lib/server/rate-limit";
import { recordJob } from "@/lib/server/history";
import { persistUploads, resultHeaders } from "@/lib/server/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(ip)) return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });

  const written: StoredFile[] = [];
  let resultPath: string | undefined;

  try {
    await ensureStorage();
    const form = await request.formData();
    const tool = String(form.get("tool") ?? "");
    const options = JSON.parse(String(form.get("options") ?? "{}")) as Record<string, string | number | boolean>;
    const files = form.getAll("files").filter((file): file is File => file instanceof File);
    if (!files.length) return NextResponse.json({ error: "Upload at least one file." }, { status: 400 });

    written.push(...(await persistUploads(files)));

    const result = await processPdfTool(tool, written, options);
    resultPath = result.path;
    const body = await readFile(result.path);
    const inputSize = written.reduce((total, file) => total + file.size, 0);
    await recordJob({
      id: nanoid(),
      tool,
      inputName: written.map((file) => file.name).join(", "),
      outputName: result.name,
      size: body.byteLength,
      status: "success",
      createdAt: Date.now(),
    });

    return new NextResponse(new Uint8Array(body), {
      headers: resultHeaders(result, inputSize, body.byteLength),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Processing failed." }, { status: 500 });
  } finally {
    await Promise.all(written.map((file) => rm(file.path, { force: true }).catch(() => undefined)));
    if (resultPath) await rm(path.dirname(resultPath), { recursive: true, force: true }).catch(() => undefined);
  }
}
