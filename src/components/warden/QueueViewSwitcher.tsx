"use client";

import { useState } from "react";
import { type QueueItem } from "@/components/warden/ComplaintQueueTable";
import { ComplaintKanbanBoard } from "@/components/warden/ComplaintKanbanBoard";
import { ComplaintCompressedTable } from "@/components/warden/ComplaintCompressedTable";

type QueueView = "compressed" | "kanban";

export function QueueViewSwitcher({ items }: { items: QueueItem[] }) {
  const [view, setView] = useState<QueueView>("kanban");

  return (
    <section className="space-y-4">
      <div className="surface-card flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-sm font-bold text-slate-900">Queue View</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch between Kanban Board and Compressed Table views.
          </p>
        </div>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              view === "kanban"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white"
            }`}
          >
            Kanban Board
          </button>
          <button
            type="button"
            onClick={() => setView("compressed")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              view === "compressed"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white"
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {view === "kanban" ? <ComplaintKanbanBoard items={items} /> : <ComplaintCompressedTable items={items} />}
    </section>
  );
}
