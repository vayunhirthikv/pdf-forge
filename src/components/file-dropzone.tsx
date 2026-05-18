"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

export function FileDropzone({
  files,
  accept,
  multiple,
  onFiles,
  onRemove,
}: {
  files: File[];
  accept: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const onDrop = useCallback((acceptedFiles: File[]) => onFiles(acceptedFiles), [onFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple });

  return (
    <div>
      <div
        {...getRootProps()}
        className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-rose-300 bg-rose-50/60 p-6 text-center transition hover:bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
      >
        <input {...getInputProps()} accept={accept} />
        <UploadCloud className="mb-4 h-10 w-10 text-rose-600" />
        <p className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{isDragActive ? "Drop files here" : "Drop files or click to upload"}</p>
        <p className="mt-1 text-sm text-zinc-500">{multiple ? "Multiple files supported" : "One file at a time"} · Files stay on this server.</p>
      </div>
      {files.length > 0 ? (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{file.name}</p>
                <p className="text-xs text-zinc-500">{formatBytes(file.size)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
