"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  complaintSubmissionSchema,
  categoryLabels,
  ComplaintCategory,
  type ComplaintSubmissionInput,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";

interface ComplaintFormProps {
  roomId: string;
  onSubmitSuccess?: () => void;
}

export function ComplaintSubmissionForm({
  roomId,
  onSubmitSuccess,
}: ComplaintFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
  } = useForm<ComplaintSubmissionInput>({
    resolver: zodResolver(complaintSubmissionSchema),
    mode: "onChange",
    defaultValues: {
      roomId,
      priority: "MEDIUM",
      attachments: [],
    },
  });

  const selectedCategory = watch("category");

  const onSubmit = async (data: ComplaintSubmissionInput) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit complaint");
      }

      const result = await response.json();
      setSuccess(true);
      reset();

      // Redirect after showing success
      setTimeout(() => {
        onSubmitSuccess?.();
        router.push(`/student/complaints/${result.id}`);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred while submitting"
      );
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                Complaint Submitted Successfully!
              </h3>
              <p className="text-sm text-green-700">
                Your complaint has been received. Redirecting...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a New Complaint</CardTitle>
        <CardDescription>
          Tell us about the issue you are experiencing in your room.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-medium">
              Complaint Title *
            </Label>
            <Input
              id="title"
              placeholder="Brief summary of the issue"
              disabled={isSubmitting}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium">
              Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about the issue... (minimum 10 characters)"
              rows={5}
              disabled={isSubmitting}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="font-medium">
              Category *
            </Label>
            <Select
              onValueChange={(value) => setValue("category", value as ComplaintCategory)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Category Help Text */}
          {selectedCategory && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <strong>Category Selected:</strong> {categoryLabels[selectedCategory]}{" "}
              - Please provide relevant details about this type of issue.
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="font-medium">
              Priority Level
            </Label>
            <Select
              defaultValue="MEDIUM"
              onValueChange={(value) =>
                setValue("priority", value as ComplaintSubmissionInput["priority"])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">
                  <span className="text-green-700">Low</span> - Minor issue
                </SelectItem>
                <SelectItem value="MEDIUM">
                  <span className="text-yellow-700">Medium</span> - Normal issue
                </SelectItem>
                <SelectItem value="HIGH">
                  <span className="text-red-700">Urgent</span> - Serious issue
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-600">{errors.priority.message}</p>
            )}
          </div>

          {/* Image Attachments */}
          <div className="space-y-2">
            <Label htmlFor="attachments" className="font-medium">
              Image URLs (Optional)
            </Label>
            <Input
              id="attachments"
              type="text"
              placeholder="https://example.com/image.jpg (comma-separated for multiple)"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-600">
              Enter valid image URLs separated by commas
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !isValid}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Complaint"
            )}
          </Button>

          <p className="text-xs text-gray-600">
            Your complaint will be reviewed by the hostel management team.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
