"use client";

import { useMemo } from "react";
import { Download, FileArchive, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewFile = {
  url?: string;
  name?: string;
  type?: string;
};

function canPreview(type?: string) {
  return !type || type === "application/pdf" || type.startsWith("image/") || type.startsWith("text/") || type === "application/json";
}

export function PdfPreview({ source, result }: { source: PreviewFile; result: PreviewFile }) {
  const panels = useMemo(
    () => [
      { title: "Original", file: source },
      { title: "Processed", file: result },
    ],
    [source, result],
  );

  return (
    <div className="grid min-h-[32rem] gap-4 xl:grid-cols-2">
      {panels.map((panel) => (
        <section key={panel.title} className="flex min-h-[24rem] flex-col rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex h-12 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{panel.title}</h3>
            {panel.file.url ? (
              <Button asChild variant="ghost" size="sm">
                <a href={panel.file.url} download={panel.file.name}>
                  <Download className="h-4 w-4" />
                  Save
                </a>
              </Button>
            ) : null}
          </header>
          {panel.file.url && canPreview(panel.file.type) ? (
            <iframe src={panel.file.url} className="h-full min-h-[28rem] w-full flex-1 rounded-b-md bg-zinc-100 dark:bg-zinc-900" title={`${panel.title} preview`} />
          ) : panel.file.url ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-zinc-500">
              <FileArchive className="h-10 w-10" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{panel.file.name ?? "Processed file"} is ready.</p>
              <p className="max-w-xs text-xs">This output type cannot be previewed in the browser panel. Use Save to download it.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-zinc-500">
              <FileText className="h-10 w-10" />
              <p className="text-sm">{panel.title === "Original" ? "Upload a PDF to preview it here." : "Run a tool to compare the result."}</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
