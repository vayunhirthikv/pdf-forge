"use client";

import { ToolDefinition } from "@/lib/tools";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ToolOptions({
  tool,
  options,
  onChange,
}: {
  tool: ToolDefinition;
  options: Record<string, string | number | boolean>;
  onChange: (key: string, value: string) => void;
}) {
  const entries = Object.entries(tool.options);
  if (entries.length === 0) return null;

  return (
    <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <label key={key} className="grid gap-1.5">
          <Label>{key}</Label>
          <Input value={String(options[key] ?? value)} onChange={(event) => onChange(key, event.target.value)} />
        </label>
      ))}
    </div>
  );
}
