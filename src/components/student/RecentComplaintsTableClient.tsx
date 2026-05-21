"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Clock, CheckCircle2, CircleDot, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { StatusBadge, statusBorderColor } from "@/components/shared/StatusBadge";

interface ComplaintUpdate {
  id: string;
  content: string;
  createdAt: Date;
  updatedBy: {
    name: string;
    role: string;
  };
}

interface Complaint {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  complaintUpdates: ComplaintUpdate[];
}

interface Props {
  complaints: Complaint[];
}

const ticketId = (id: string): string => `#${id.slice(0, 8).toUpperCase()}`;

const formatCategory = (cat: string): string => {
  if (!cat) return "";
  const lower = cat.toLowerCase().trim();
  if (lower === "other" || lower === "others") return "Others";
  return cat.toLowerCase().replace("_", " ");
};

const relativeDate = (date: Date): string => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function RecentComplaintsTableClient({ complaints }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(prev => prev === id ? null : id);
  };

  if (complaints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">No complaints yet</p>
        <p className="text-xs text-slate-500">Submit your first complaint to see it here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            <th className="px-5 py-3 w-32">Ticket ID</th>
            <th className="px-5 py-3">Title</th>
            <th className="px-5 py-3 w-36">Status</th>
            <th className="px-5 py-3 w-28 text-right">Submitted</th>
            <th className="px-5 py-3 w-28 text-right">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {complaints.map((item) => {
            const isExpanded = expandedId === item.id;
            
            // Build timeline events
            const events = [
              {
                id: 'submitted',
                title: 'Complaint Submitted',
                desc: 'Ticket created and assigned for review.',
                date: item.createdAt,
                icon: Clock,
                color: 'text-slate-400',
                bg: 'bg-slate-100'
              }
            ];

            if (item.status === 'IN_PROGRESS' || item.complaintUpdates.length > 0) {
              events.push({
                id: 'in-progress',
                title: 'Work In Progress',
                desc: 'Management is actively handling this issue.',
                date: item.complaintUpdates[0]?.createdAt || item.updatedAt,
                icon: CircleDot,
                color: 'text-blue-500',
                bg: 'bg-blue-50'
              });
            }

            item.complaintUpdates.forEach(update => {
              events.push({
                id: update.id,
                title: `Update from ${update.updatedBy.role.toLowerCase()}`,
                desc: update.content,
                date: update.createdAt,
                icon: FileText,
                color: 'text-amber-500',
                bg: 'bg-amber-50'
              });
            });

            if (item.status === 'RESOLVED' || item.status === 'CLOSED') {
              events.push({
                id: 'resolved',
                title: 'Complaint Resolved',
                desc: 'The issue has been marked as resolved.',
                date: item.resolvedAt || item.closedAt || item.updatedAt,
                icon: CheckCircle2,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50'
              });
            }

            // Sort events by date ascending
            events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return (
              <Fragment key={item.id}>
                <tr
                  className={`group relative transition-colors duration-150 cursor-pointer ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50'}`}
                  style={{ borderLeft: `3px solid ${statusBorderColor(item.status)}` }}
                  onClick={() => router.push(`/complaints/${item.id}`)}
                >
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => toggleRow(item.id, e)}
                      className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-500 transition-colors group-hover:text-blue-700 hover:underline underline-offset-4 focus:outline-none"
                      aria-expanded={isExpanded}
                      aria-label={`Toggle timeline for complaint ${ticketId(item.id)}`}
                    >
                      {ticketId(item.id)}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800 group-hover:text-slate-900 line-clamp-1">
                      {item.title || "—"}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-slate-400">
                      {formatCategory(item.category)}
                      {item.priority && item.priority !== "ROUTINE" && (
                        <span
                          className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            item.priority === "EMERGENCY"
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {item.priority}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-slate-500 tabular-nums">
                    {new Date(item.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-slate-400 tabular-nums">
                    {relativeDate(item.updatedAt)}
                  </td>
                </tr>

                {/* Expanded Timeline Row */}
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="p-0 border-0">
                      <div className="overflow-hidden bg-slate-50/50 border-b border-slate-100 px-6 py-5 shadow-inner">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          
                          {/* Left: Timeline */}
                          <div className="flex-1 w-full relative pl-2">
                            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200"></div>
                            <ul className="space-y-4">
                              {events.map((event, idx) => (
                                <li key={event.id} className="relative flex items-start gap-3">
                                  <div className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ring-1 ring-slate-100 shadow-sm ${event.bg}`}>
                                    <event.icon className={`h-2.5 w-2.5 ${event.color}`} />
                                  </div>
                                  <div className="flex-1 pb-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold text-slate-700">{event.title}</p>
                                      <span className="text-[10px] font-medium text-slate-400">
                                        {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-500">{event.desc}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Right: Actions */}
                          <div className="w-full md:w-56 shrink-0 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm border border-slate-200/60">
                            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-1">Actions</h4>
                            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                              Need to provide more evidence or speak with management?
                            </p>
                            <Link 
                              href={`/complaints/${item.id}`}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open Full Details
                            </Link>
                          </div>
                          
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
