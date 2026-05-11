"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  statusLabels,
  statusColors,
  type ComplaintStatus,
} from "@/lib/validations";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ComplaintStatus;
  createdAt: string;
  room: {
    roomNumber: string;
  };
}

export default function StudentComplaintsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchComplaints = async () => {
      setError(null);
      try {
        const response = await fetch("/api/complaints?limit=50");
        if (!response.ok) throw new Error("Failed to fetch complaints");

        const data = await response.json();
        setComplaints(data.complaints);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch complaints"
        );
      } finally {
        setIsFetching(false);
      }
    };

    fetchComplaints();
  }, [isAuthenticated]);

  if (isLoading || isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="surface-hero px-5 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">My Complaints</h1>
            <Link href="/complaints/new">
              <Button className="bg-gradient-to-r from-sky-600 to-blue-700 text-white hover:from-sky-700 hover:to-blue-800">
                <Plus className="mr-2 h-4 w-4" />
                New Complaint
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-700">Track all submissions, responses, and progress in one place.</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50/90 shadow-sm">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </CardContent>
          </Card>
        )}

        {complaints.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="pt-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No complaints yet
              </h3>
              <p className="mt-2 text-gray-600">
                Submit your first complaint to get started.
              </p>
              <Link href="/complaints/new">
                <Button className="mt-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white hover:from-sky-700 hover:to-blue-800">
                  <Plus className="mr-2 h-4 w-4" />
                  Submit First Complaint
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {complaints.map((complaint) => (
              <Link
                key={complaint.id}
                href={`/complaints/${complaint.id}`}
              >
                {/* ── Mobile Card (<md): Compact vertical stack ──── */}
                <div className="surface-card cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
                  <div className="px-4 pt-4 pb-3 flex flex-col gap-2">
                    {/* Ticket ID */}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      #{complaint.id.slice(0, 8).toUpperCase()}
                    </p>
                    {/* Status Badge */}
                    <Badge className={statusColors[complaint.status]}>
                      {statusLabels[complaint.status]}
                    </Badge>
                    {/* Date */}
                    <p className="text-xs text-slate-500">
                      {new Date(complaint.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {/* Title — still useful on mobile */}
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                      {complaint.title}
                    </p>
                  </div>
                </div>

                {/* ── Desktop Card (md+): Rich layout ────────────── */}
                <div className="hidden md:block">
                  <Card className="surface-card cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {complaint.title}
                            </h3>
                            <Badge
                              className={statusColors[complaint.status]}
                            >
                              {statusLabels[complaint.status]}
                            </Badge>
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                            {complaint.description}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">
                                Category:
                              </span>{" "}
                              <span className="text-gray-600">
                                {complaint.category}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">
                                Room:
                              </span>{" "}
                              <span className="text-gray-600">
                                {complaint.room.roomNumber}
                              </span>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-gray-500">
                            Submitted:{" "}
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Link>
            ))}
          </div>

        )}
      </main>
    </div>
  );
}
