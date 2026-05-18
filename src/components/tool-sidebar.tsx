"use client";

import { toolCategories, tools } from "@/lib/tools";
import { cn } from "@/lib/utils";

export function ToolSidebar({ activeTool, onSelect }: { activeTool: string; onSelect: (tool: string) => void }) {
  return (
    <aside className="w-full border-r border-zinc-200 bg-white/90 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:h-screen lg:w-80 lg:overflow-y-auto">
      <div className="mb-5 px-2">
        <div className="text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">PDFForge</div>
        <p className="mt-1 text-sm text-zinc-500">Private PDF tools for your server.</p>
      </div>
      <nav className="space-y-5">
        {toolCategories.map((category) => (
          <section key={category}>
            <h2 className="mb-2 px-2 text-xs font-bold uppercase text-zinc-400">{category}</h2>
            <div className="grid gap-1">
              {tools
                .filter((tool) => tool.category === category)
                .map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => onSelect(tool.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm transition",
                        activeTool === tool.id
                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{tool.name}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
