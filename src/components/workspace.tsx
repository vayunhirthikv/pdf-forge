"use client";

import confetti from "canvas-confetti";
import { BarChart3, Boxes, GitBranch, Moon, Play, Sun, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { AdminDashboard } from "@/components/admin-dashboard";
import { FileDropzone } from "@/components/file-dropzone";
import { PdfPreview } from "@/components/pdf-preview";
import { ToolOptions } from "@/components/tool-options";
import { ToolSidebar } from "@/components/tool-sidebar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WorkflowBuilder, type WorkflowStep } from "@/components/workflow-builder";
import { defaultTool, tools } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

type RunMode = "single" | "batch" | "workflow" | "admin";

type ResultMeta = {
  inputSize?: number;
  outputSize?: number;
  savedBytes?: number;
  savedPercent?: number;
  compressionEngine?: string;
  redactionVerified?: boolean;
  redactionMessage?: string;
  files?: number;
  report?: Array<Record<string, string | number | boolean>>;
  steps?: Array<Record<string, string | number | boolean>>;
};

export function Workspace() {
  const [activeToolId, setActiveToolId] = useState(defaultTool.id);
  const activeTool = useMemo(() => tools.find((tool) => tool.id === activeToolId) ?? defaultTool, [activeToolId]);
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<Record<string, string | number | boolean>>(activeTool.options);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [resultUrl, setResultUrl] = useState<string>();
  const [mode, setMode] = useState<RunMode>("single");
  const [meta, setMeta] = useState<ResultMeta>();
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { tool: "compress", options: tools.find((tool) => tool.id === "compress")?.options ?? {} },
    { tool: "watermark", options: tools.find((tool) => tool.id === "watermark")?.options ?? {} },
    { tool: "page-numbers", options: tools.find((tool) => tool.id === "page-numbers")?.options ?? {} },
  ]);
  const { theme, setTheme } = useTheme();

  function selectTool(toolId: string) {
    const next = tools.find((tool) => tool.id === toolId) ?? defaultTool;
    setActiveToolId(toolId);
    setOptions(next.options);
    setFiles([]);
    setResultUrl(undefined);
    setMeta(undefined);
  }

  async function processFiles() {
    if (!files.length) {
      toast.error("Add at least one file first.");
      return;
    }

    setBusy(true);
    setProgress(18);
    setResultUrl(undefined);
    setMeta(undefined);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    if (mode === "workflow") {
      formData.append("steps", JSON.stringify(workflowSteps));
    } else {
      formData.append("tool", activeTool.id);
      formData.append("options", JSON.stringify(options));
    }
    setSourceUrl(URL.createObjectURL(files[0]));

    try {
      setProgress(42);
      const endpoint = mode === "batch" ? "/api/batch" : mode === "workflow" ? "/api/workflow" : "/api/process";
      const response = await fetch(endpoint, { method: "POST", body: formData });
      setProgress(78);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Processing failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      const headerMeta = response.headers.get("X-PDFForge-Meta");
      setMeta(headerMeta ? (JSON.parse(headerMeta) as ResultMeta) : undefined);
      setProgress(100);
      toast.success(mode === "batch" ? "Batch ZIP is ready." : mode === "workflow" ? "Workflow finished." : "PDFForge finished processing.");
      confetti({ particleCount: 90, spread: 65, origin: { y: 0.82 } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Processing failed.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 lg:flex">
      <ToolSidebar activeTool={activeTool.id} onSelect={selectTool} />
      <main className="flex-1">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
          <div>
            <h1 className="text-xl font-black tracking-tight">{mode === "admin" ? "Admin Dashboard" : mode === "workflow" ? "Workflow Builder" : activeTool.name}</h1>
            <p className="text-sm text-zinc-500">
              {mode === "admin" ? "Jobs, storage, and usage telemetry." : mode === "workflow" ? "Chain PDF tasks into one repeatable run." : activeTool.description}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode">
            <Sun className="h-4 w-4 scale-100 dark:scale-0" />
            <Moon className="absolute h-4 w-4 scale-0 dark:scale-100" />
          </Button>
        </header>
        <div className="grid gap-5 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {[
              ["single", Wrench, "Single"],
              ["batch", Boxes, "Batch"],
              ["workflow", GitBranch, "Workflow"],
              ["admin", BarChart3, "Admin"],
            ].map(([nextMode, Icon, label]) => {
              const ModeIcon = Icon as typeof Wrench;
              return (
                <Button key={String(nextMode)} type="button" variant={mode === nextMode ? "default" : "outline"} size="sm" onClick={() => setMode(nextMode as RunMode)}>
                  <ModeIcon className="h-4 w-4" />
                  {String(label)}
                </Button>
              );
            })}
          </div>
          {mode === "admin" ? (
            <AdminDashboard />
          ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(20rem,28rem)_1fr]">
            <div className="grid content-start gap-4">
              <FileDropzone
                files={files}
                accept={activeTool.accepts}
                multiple={mode === "batch" || activeTool.multiple}
                onFiles={(incoming) => setFiles((current) => (mode === "batch" || activeTool.multiple ? [...current, ...incoming] : incoming.slice(0, 1)))}
                onRemove={(index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
              />
              {mode === "workflow" ? (
                <WorkflowBuilder steps={workflowSteps} onChange={setWorkflowSteps} />
              ) : (
                <ToolOptions tool={activeTool} options={options} onChange={(key, value) => setOptions((current) => ({ ...current, [key]: value }))} />
              )}
              {meta ? (
                <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="mb-2 font-bold">Result intelligence</div>
                  <div className="grid gap-2 text-zinc-600 dark:text-zinc-300">
                    {typeof meta.inputSize === "number" && typeof meta.outputSize === "number" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <span>{formatBytes(meta.inputSize)}</span>
                        <span>{formatBytes(meta.outputSize)}</span>
                        <span className={Number(meta.savedBytes) >= 0 ? "text-emerald-600" : "text-amber-600"}>{meta.savedPercent}% saved</span>
                      </div>
                    ) : null}
                    {meta.compressionEngine ? <p>Compression engine: {meta.compressionEngine}</p> : null}
                    {meta.redactionMessage ? <p className={meta.redactionVerified ? "text-emerald-600" : "text-amber-600"}>{meta.redactionMessage}</p> : null}
                    {meta.files ? <p>{meta.files} files processed into a batch ZIP.</p> : null}
                    {meta.steps ? <p>{meta.steps.length} workflow steps completed.</p> : null}
                  </div>
                </div>
              ) : null}
              <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Progress</span>
                  <span className="text-xs text-zinc-500">{progress}%</span>
                </div>
                <Progress value={progress} />
                <Button className="mt-4 w-full" disabled={busy} onClick={processFiles}>
                  <Play className="h-4 w-4" />
                  {busy ? "Processing..." : mode === "batch" ? `Batch ${activeTool.name}` : mode === "workflow" ? "Run Workflow" : `Run ${activeTool.name}`}
                </Button>
              </div>
            </div>
            <PdfPreview sourceUrl={sourceUrl} resultUrl={resultUrl} />
          </section>
          )}
        </div>
      </main>
    </div>
  );
}
