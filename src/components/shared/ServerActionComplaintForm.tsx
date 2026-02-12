"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  complaintSubmissionSchema,
  categoryLabels,
  ComplaintCategory,
  type ComplaintSubmissionInput,
} from "@/lib/validations";
import { createComplaint } from "@/actions/complaints";
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
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface ComplaintFormProps {
  roomId: string;
  hostelName?: string;
}

export function ServerActionComplaintForm({
  roomId,
  hostelName,
}: ComplaintFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string>("");

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
    setError("");

    startTransition(async () => {
      try {
        const result = await createComplaint(data);

        if (!result.success) {
          setError(result.error || "Failed to submit complaint");
          return;
        }

        setShowSuccess(true);
        reset();

        setTimeout(() => {
          router.push(`/complaints/${result.data?.id}`);
          router.refresh();
        }, 2000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }
    });
  };

  if (showSuccess) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                Complaint Submitted Successfully
              </h3>
              <p className="text-sm text-green-700">
                Your complaint has been received. Redirecting to details...
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
          {hostelName && <span>Hostel: {hostelName}</span>}
          {!hostelName && "Tell us about the issue you are experiencing"}
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

          <div className="space-y-2">
            <Label htmlFor="title" className="font-medium">
              Complaint Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Brief summary of the issue"
              disabled={isPending}
              {...register("title")}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
            <p className="text-xs text-gray-500">5-100 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium">
              Detailed Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about the issue, when it started, and any impacts..."
              rows={5}
              disabled={isPending}
              {...register("description")}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
            <p className="text-xs text-gray-500">10-2000 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="font-medium">
              Issue Category <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value) =>
                setValue("category", value as ComplaintCategory)
              }
              disabled={isPending}
            >
              <SelectTrigger className={errors.category ? "border-red-500" : ""}>
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

          {selectedCategory && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <strong>Selected Category:</strong> {categoryLabels[selectedCategory]} -
              Ensure your description matches this category for faster
              resolution.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority" className="font-medium">
              Priority Level
            </Label>
            <Select
              defaultValue="MEDIUM"
              onValueChange={(value) =>
                setValue("priority", value as ComplaintSubmissionInput["priority"])
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low - Minor issue, can wait</SelectItem>
                <SelectItem value="MEDIUM">
                  Medium - Normal issue (default)
                </SelectItem>
                <SelectItem value="HIGH">Urgent - Serious issue</SelectItem>
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-600">{errors.priority.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachments" className="font-medium">
              Image URLs (Optional)
            </Label>
            <Input
              id="attachments"
              type="text"
              placeholder="https://example.com/image.jpg (comma-separated for multiple)"
              disabled={isPending}
            />
            <p className="text-xs text-gray-600">
              Enter valid image URLs separated by commas to help illustrate the
              issue.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !isValid}
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Complaint...
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
