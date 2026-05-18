"use client";

import { useMemo } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfPreview({ sourceUrl, resultUrl }: { sourceUrl?: string; resultUrl?: string }) {
  const panels = useMemo(
    () => [
      { title: "Original", url: sourceUrl },
      { title: "Processed", url: resultUrl },
    ],
    [sourceUrl, resultUrl],
  );

  return (
    <div className="grid min-h-[32rem] gap-4 xl:grid-cols-2">
      {panels.map((panel) => (
        <section key={panel.title} className="flex min-h-[24rem] flex-col rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex h-12 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{panel.title}</h3>
            {panel.url ? (
              <Button asChild variant="ghost" size="sm">
                <a href={panel.url} download>
                  <Download className="h-4 w-4" />
                  Save
                </a>
              </Button>
            ) : null}
          </header>
          {panel.url ? (
            <iframe src={panel.url} className="h-full min-h-[28rem] w-full flex-1 rounded-b-md bg-zinc-100 dark:bg-zinc-900" title={`${panel.title} preview`} />
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
