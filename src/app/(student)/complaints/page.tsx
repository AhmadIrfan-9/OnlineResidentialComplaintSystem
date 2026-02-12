"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  statusLabels,
  statusColors,
  categoryLabels,
  priorityLabels,
  priorityColors,
  type ComplaintCategory,
  type ComplaintStatus,
  type Priority,
} from "@/lib/validations";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: Priority;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">My Complaints</h1>
            <Link href="/student/complaints/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Complaint
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </CardContent>
          </Card>
        )}

        {complaints.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No complaints yet
              </h3>
              <p className="mt-2 text-gray-600">
                Submit your first complaint to get started.
              </p>
              <Link href="/student/complaints/new">
                <Button className="mt-4">
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
                href={`/student/complaints/${complaint.id}`}
              >
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {complaint.title}
                          </h3>
                          <Badge
                            className={statusColors[complaint.status]}
                          >
                            {statusLabels[complaint.status]}
                          </Badge>
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                          {complaint.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-4">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">
                              Category:
                            </span>{" "}
                            <span className="text-gray-600">
                              {categoryLabels[complaint.category]}
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
                          <Badge
                            className={priorityColors[complaint.priority]}
                            variant="secondary"
                          >
                            {priorityLabels[complaint.priority]}
                          </Badge>
                        </div>

                        <p className="mt-3 text-xs text-gray-500">
                          Submitted:{" "}
                          {new Date(complaint.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
