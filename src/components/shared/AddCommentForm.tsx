"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare } from "lucide-react";
import { addComplaintComment } from "@/actions/complaints";

interface AddCommentFormProps {
  complaintId: string;
  onSuccess?: () => void;
}

export function AddCommentForm({
  complaintId,
  onSuccess,
}: AddCommentFormProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (message.trim().length === 0) {
      setError("Comment cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const result = await addComplaintComment(complaintId, message);

      if (result.success) {
        setMessage("");
        setSuccess(true);
        onSuccess?.();
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || "Failed to add comment");
      }
    } catch (err) {
      setError("An error occurred while adding the comment");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <label className="font-medium">Add a Comment</label>
        </div>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share your update or thoughts about this complaint..."
          className="resize-none"
          rows={4}
          disabled={loading}
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {message.length}/2000 characters
          </div>
          <Button
            type="submit"
            disabled={loading || message.trim().length === 0}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Post Comment
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Comment added successfully!</p>
        )}
      </form>
    </Card>
  );
}
