"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  categoryLabels,
  statusColors,
  statusLabels,
} from "@/lib/validations";
import {
  ComplaintCategory,
  ComplaintStatus,
} from "@/lib/validations";
import { Loader2 } from "lucide-react";
import { updateComplaintStatus } from "@/actions/complaints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ComplaintDataRow {
  id: string;
  title: string;
  student: {
    name: string;
  } | null;
  room: {
    roomNumber: string;
  };
  category: ComplaintCategory;
  status: ComplaintStatus;
  createdAt: string;
}

export function ComplaintsDataTable() {
  const [complaints, setComplaints] = useState<ComplaintDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/complaints");
        if (!response.ok) {
          throw new Error("Failed to fetch complaints");
        }
        const data = await response.json();
        // Handle both response formats: { complaints: [...] } and { data: [...] }
        const complaintsList = data.complaints || data.data || data;
        setComplaints(Array.isArray(complaintsList) ? complaintsList : []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch complaints"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, []);

  const handleStatusChange = async (
    complaintId: string,
    newStatus: string
  ) => {
    setUpdatingId(complaintId);
    try {
      const result = await updateComplaintStatus(complaintId, newStatus);
      if (result.success) {
        // Update local state
        setComplaints((prevComplaints) =>
          prevComplaints.map((complaint) =>
            complaint.id === complaintId
              ? { ...complaint, status: newStatus as ComplaintStatus }
              : complaint
          )
        );
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert("Failed to update status");
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="border border-slate-200/80 bg-slate-50 p-8 shadow-none">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-600">Loading complaints...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-red-200 bg-red-50 p-8">
        <p className="text-red-700">Error: {error}</p>
      </Card>
    );
  }

  if (complaints.length === 0) {
    return (
      <Card className="border border-slate-200/80 bg-slate-50 p-8 text-center shadow-none">
        <p className="text-slate-600">No complaints found for your hostel</p>
      </Card>
    );
  }

  // Status options for the dropdown
  const statusOptions = [
    "SUBMITTED",
    "ACKNOWLEDGED",
    "UNDER_REVIEW",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ];

  return (
    <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-none">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Student Name</TableHead>
            <TableHead className="font-semibold text-slate-700">Room</TableHead>
            <TableHead className="font-semibold text-slate-700">Category</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map((complaint) => (
            <TableRow
              key={complaint.id}
              className="transition-colors hover:bg-slate-50"
            >
              <TableCell className="font-medium text-slate-800">
                {complaint.student?.name ?? "Anonymous"}
              </TableCell>
              <TableCell className="text-slate-700">{complaint.room.roomNumber}</TableCell>
              <TableCell>
                {categoryLabels[complaint.category] || complaint.category}
              </TableCell>
              <TableCell>
                <Select
                  value={complaint.status}
                  onValueChange={(newStatus) =>
                    handleStatusChange(complaint.id, newStatus)
                  }
                  disabled={updatingId === complaint.id}
                >
                  <SelectTrigger className="w-40 border-0 p-0 h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge
                          className={
                            statusColors[status as ComplaintStatus]
                          }
                        >
                          {statusLabels[status as ComplaintStatus]}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right text-sm text-slate-600">
                {new Date(complaint.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
