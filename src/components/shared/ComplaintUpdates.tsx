"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { getComplaintUpdates } from "@/actions/complaints";
import Image from "next/image";

interface Update {
  id: string;
  updateType: string;
  message: string;
  oldStatus: string | null;
  newStatus: string | null;
  createdAt: Date;
  updatedBy: {
    name: string;
    role: string;
    avatar: string | null;
  };
}

interface ComplaintUpdatesProps {
  complaintId: string;
}

const getUpdateIcon = (type: string) => {
  switch (type) {
    case "STATUS_CHANGE":
      return <CheckCircle className="h-5 w-5 text-blue-600" />;
    case "COMMENT":
      return <MessageSquare className="h-5 w-5 text-green-600" />;
    case "ASSIGNMENT":
      return <AlertCircle className="h-5 w-5 text-purple-600" />;
    default:
      return <Clock className="h-5 w-5 text-gray-600" />;
  }
};

const getUpdateTypeLabel = (type: string) => {
  switch (type) {
    case "STATUS_CHANGE":
      return "Status Changed";
    case "COMMENT":
      return "Comment Added";
    case "ASSIGNMENT":
      return "Assigned";
    default:
      return "Update";
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role.toUpperCase()) {
    case "WARDEN":
      return "bg-blue-100 text-blue-800";
    case "STAFF":
      return "bg-purple-100 text-purple-800";
    case "STUDENT":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function ComplaintUpdates({ complaintId }: ComplaintUpdatesProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        setLoading(true);
        const result = await getComplaintUpdates(complaintId);
        if (result.success && result.updates) {
          setUpdates(result.updates);
        } else {
          setError(result.error || "Failed to fetch updates");
        }
      } catch (err) {
        setError("An error occurred while fetching updates");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpdates();
  }, [complaintId]);

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-600">Loading updates...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-red-700">{error}</p>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No updates yet. Check back soon for status updates!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">My Updates</h3>
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Updates list */}
        {updates.map((update, index) => (
          <div key={update.id} className="relative pl-20">
            {/* Timeline dot */}
            <div className="absolute left-0 top-1 flex items-center justify-center h-12 w-12 rounded-full bg-white border-2 border-gray-200">
              {getUpdateIcon(update.updateType)}
            </div>

            {/* Update card */}
            <Card className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {update.updatedBy.avatar && (
                    <Image
                      src={update.updatedBy.avatar}
                      alt={update.updatedBy.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{update.updatedBy.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor(update.updatedBy.role)}>
                        {update.updatedBy.role}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(update.createdAt).toLocaleDateString()} at{" "}
                        {new Date(update.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Update type badge */}
              <Badge variant="outline" className="mb-3">
                {getUpdateTypeLabel(update.updateType)}
              </Badge>

              {/* Update message */}
              <p className="text-gray-700 mb-2">{update.message}</p>

              {/* Status change details */}
              {update.updateType === "STATUS_CHANGE" &&
                update.oldStatus &&
                update.newStatus && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md text-sm">
                    <p className="text-gray-700">
                      Status changed from{" "}
                      <Badge className="bg-blue-100 text-blue-800">
                        {update.oldStatus}
                      </Badge>{" "}
                      to{" "}
                      <Badge className="bg-green-100 text-green-800">
                        {update.newStatus}
                      </Badge>
                    </p>
                  </div>
                )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
