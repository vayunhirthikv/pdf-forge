"use client";

import { useEffect, useState } from "react";
import { Activity, Database, HardDrive, ShieldCheck } from "lucide-react";
import { formatBytes } from "@/lib/utils";

type Stats = {
  totalJobs: number;
  successfulJobs: number;
  totalBytes: number;
  byTool: Record<string, number>;
  recentJobs: Array<{ id: string; tool: string; inputName: string; outputName: string; size: number; status: string; createdAt: number }>;
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>();

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((response) => response.json())
      .then(setStats)
      .catch(() => setStats(undefined));
  }, []);

  if (!stats) {
    return <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">Loading admin telemetry...</div>;
  }

  const cards = [
    { label: "Total jobs", value: stats.totalJobs, icon: Activity },
    { label: "Successful", value: stats.successfulJobs, icon: ShieldCheck },
    { label: "Output volume", value: formatBytes(stats.totalBytes), icon: HardDrive },
    { label: "Tools used", value: Object.keys(stats.byTool).length, icon: Database },
  ];

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <Icon className="mb-3 h-5 w-5 text-rose-600" />
              <div className="text-2xl font-black">{card.value}</div>
              <div className="text-xs font-semibold uppercase text-zinc-500">{card.label}</div>
            </div>
          );
        })}
      </div>
      <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-bold dark:border-zinc-800">Recent jobs</div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {stats.recentJobs.length ? (
            stats.recentJobs.map((job) => (
              <div key={job.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_auto]">
                <span className="font-semibold">{job.tool}</span>
                <span className="truncate text-zinc-500">{job.outputName}</span>
                <span className="text-zinc-500">{formatBytes(job.size)}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">No jobs yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
