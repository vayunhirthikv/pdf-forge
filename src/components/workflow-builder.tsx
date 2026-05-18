"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tools } from "@/lib/tools";

export type WorkflowStep = {
  tool: string;
  options: Record<string, string | number | boolean>;
};

const recommended = ["compress", "watermark", "page-numbers", "protect"];

export function WorkflowBuilder({ steps, onChange }: { steps: WorkflowStep[]; onChange: (steps: WorkflowStep[]) => void }) {
  function addStep(toolId: string) {
    const tool = tools.find((item) => item.id === toolId);
    if (!tool) return;
    onChange([...steps, { tool: tool.id, options: tool.options }]);
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Workflow builder</h2>
          <p className="text-xs text-zinc-500">Chain tools into one download.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {recommended.map((toolId) => {
          const tool = tools.find((item) => item.id === toolId);
          if (!tool) return null;
          return (
            <Button key={toolId} type="button" variant="secondary" size="sm" onClick={() => addStep(toolId)}>
              <Plus className="h-3.5 w-3.5" />
              {tool.name}
            </Button>
          );
        })}
      </div>
      <div className="space-y-2">
        {steps.length ? (
          steps.map((step, index) => {
            const tool = tools.find((item) => item.id === step.tool);
            return (
              <div key={`${step.tool}-${index}`} className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                <span>
                  <span className="mr-2 font-black text-rose-600">{index + 1}</span>
                  {tool?.name ?? step.tool}
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))} aria-label="Remove workflow step">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500 dark:bg-zinc-900">Add steps to run a reusable document workflow.</div>
        )}
      </div>
    </div>
  );
}
