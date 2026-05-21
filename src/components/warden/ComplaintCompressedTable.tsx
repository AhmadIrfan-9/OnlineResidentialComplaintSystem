"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { QueueItem } from "@/components/warden/ComplaintQueueTable";

const CATEGORY_LABEL = (raw: string) => {
  if (raw.toUpperCase() === "OTHER") return "Others";
  return raw
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
};

export function ComplaintCompressedTable({ items }: { items: QueueItem[] }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set(items.map((item) => item.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = activeCategory === null || item.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.ticketId.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.student.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        CATEGORY_LABEL(item.category).toLowerCase().includes(q)
      );
    });
  }, [items, search, activeCategory]);

  return (
    <div className="mx-4 mb-6 space-y-4 md:mx-6">
      {/* ── Filter bar ── */}
      <div className="surface-card p-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by keyword, ticket, student or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeCategory === null
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Categories
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {CATEGORY_LABEL(cat)}
            </button>
          ))}
        </div>

        {/* Result count */}
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{items.length}</span> complaints
        </p>
      </div>

      {/* ── Table ── */}
      <div className="surface-card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Ticket</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Management</th>
              <th className="px-4 py-3 text-center">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No complaints match your search or filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.complaintId}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {item.ticketId}
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <span className="block font-medium text-slate-800 truncate" title={item.title}>
                      {item.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60">
                      {CATEGORY_LABEL(item.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.student}</td>
                  <td className="px-4 py-3 text-slate-700">{item.management}</td>
                  <td className="px-4 py-3 text-center">
                    {item.evidences.length > 0 ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {item.evidences.length}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
