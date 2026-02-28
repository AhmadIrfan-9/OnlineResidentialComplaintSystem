"use client";

import { useState } from "react";
import { type QueueItem } from "@/components/warden/ComplaintQueueTable";
import { ComplaintKanbanBoard } from "@/components/warden/ComplaintKanbanBoard";
import { ComplaintCompressedTable } from "@/components/warden/ComplaintCompressedTable";

type QueueView = "compressed" | "kanban";

export function QueueViewSwitcher({ items }: { items: QueueItem[] }) {
  const [view, setView] = useState<QueueView>("kanban");

  return (
    <section className="space-y-3">
      <div className="surface-card flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Queue View</p>
          <p className="text-xs text-slate-600">
            Switch between Kanban Board View and Compressed Table View.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "kanban"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Kanban Board View
          </button>
          <button
            type="button"
            onClick={() => setView("compressed")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "compressed"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Compressed Table View
          </button>
        </div>
      </div>

      {view === "kanban" ? <ComplaintKanbanBoard items={items} /> : <ComplaintCompressedTable items={items} />}
    </section>
  );
}
