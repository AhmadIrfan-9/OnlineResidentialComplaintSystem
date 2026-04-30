"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { AlertCircle, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { SuccessView } from "@/components/shared/SuccessView";

// ─── Loading Overlay Status Config ────────────────────────────────────────────

const LOADING_STAGES = [
  {
    minPercent: 0,
    maxPercent: 30,
    en: "Checking fields...",
    ms: "Mengesahkan borang...",
  },
  {
    minPercent: 30,
    maxPercent: 60,
    en: "AI Image Verification...",
    ms: "Pengesahan AI untuk gambar...",
  },
  {
    minPercent: 60,
    maxPercent: 90,
    en: "Checking Handbook Policy...",
    ms: "Menyemak Polisi Buku Panduan...",
  },
  {
    minPercent: 90,
    maxPercent: 100,
    en: "Saving to Database...",
    ms: "Menyimpan ke pangkalan data...",
  },
] as const;

function getStageForPercent(percent: number) {
  return (
    LOADING_STAGES.find(
      (s) => percent >= s.minPercent && percent < s.maxPercent
    ) ?? LOADING_STAGES[LOADING_STAGES.length - 1]
  );
}

// ─── Required Label Helper ────────────────────────────────────────────────────

function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="font-medium">
      {children} <span className="text-red-500">*</span>
    </Label>
  );
}

// ─── Full-Screen Loading Overlay ──────────────────────────────────────────────

function SubmissionLoadingOverlay({ progress }: { progress: number }) {
  const stage = getStageForPercent(progress);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-md">
        {/* UNITEN Branding Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Submitting Complaint
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            UNITEN Residential Complaint System
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-red-500 to-blue-700 transition-all duration-500 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Progress
            </span>
            <span className="text-sm font-bold tabular-nums text-blue-700">
              {Math.round(clampedProgress)}%
            </span>
          </div>
        </div>

        {/* Bilingual Status Messages */}
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <p className="text-sm font-semibold text-slate-800">{stage.en}</p>
          </div>
          <p className="text-xs text-slate-500 italic">{stage.ms}</p>
        </div>

        {/* Stage Indicators */}
        <div className="mt-5 grid grid-cols-4 gap-1.5">
          {LOADING_STAGES.map((s, i) => {
            const isActive = stage === s;
            const isComplete = clampedProgress >= s.maxPercent;
            return (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  isComplete
                    ? "bg-blue-600"
                    : isActive
                      ? "animate-pulse bg-red-500"
                      : "bg-slate-200"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Form Component ──────────────────────────────────────────────────────

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
  const [submittedData, setSubmittedData] = useState<{ id: string; severityScore?: number; fellowName?: string } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      attachments: [],
    },
  });

  const selectedCategory = watch("category");

  // ── Progress simulation ─────────────────────────────────────────────────
  const startProgressSimulation = useCallback(() => {
    setLoadingProgress(0);

    // Clear any existing timer
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    let current = 0;
    progressTimerRef.current = setInterval(() => {
      // Slow down as we approach 90% — waits for real completion
      const increment =
        current < 30
          ? 2.5 // Fast: field checking phase
          : current < 60
            ? 1.5 // Medium: AI verification
            : current < 85
              ? 0.8 // Slow: policy checking
              : 0.2; // Very slow: waiting for DB

      current = Math.min(88, current + increment);
      setLoadingProgress(current);
    }, 150);
  }, []);

  const completeProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    // Animate from current to 100%
    setLoadingProgress(92);
    setTimeout(() => setLoadingProgress(96), 200);
    setTimeout(() => setLoadingProgress(100), 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setLoadingProgress(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // ── Form submission handler ─────────────────────────────────────────────
  const onSubmit = async (data: ComplaintSubmissionInput) => {
    setIsSubmitting(true);
    setError(null);
    startProgressSimulation();

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

      // Complete the progress bar before showing success
      completeProgress();

      // Wait for progress to visually reach 100% before transitioning
      setTimeout(() => {
        setSubmittedData({
          id: result.id,
          // Extract these if they are returned by the API (or from RAG pipeline)
          severityScore: result.severityScore,
          fellowName: result.fellowName,
        });
        setSuccess(true);
        reset();
      }, 800);
    } catch (err) {
      stopProgress();
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while submitting"
      );
      setIsSubmitting(false);
    }
  };

  // ── Success State ───────────────────────────────────────────────────────
  if (success && submittedData) {
    return (
      <SuccessView
        complaintId={submittedData.id}
        severityScore={submittedData.severityScore}
        fellowName={submittedData.fellowName}
        onContinue={() => {
          onSubmitSuccess?.();
          router.push(`/student/complaints/${submittedData.id}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      {/* Full-Screen Loading Overlay */}
      {isSubmitting && <SubmissionLoadingOverlay progress={loadingProgress} />}

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
              <RequiredLabel htmlFor="title">Complaint Title</RequiredLabel>
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
              <RequiredLabel htmlFor="description">Description</RequiredLabel>
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
              <RequiredLabel htmlFor="category">Category</RequiredLabel>
              <Select
                onValueChange={(value) =>
                  setValue("category", value as ComplaintCategory)
                }
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
                <p className="text-sm text-red-600">
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* Category Help Text */}
            {selectedCategory && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Category Selected:</strong>{" "}
                {categoryLabels[selectedCategory]} - Please provide relevant
                details about this type of issue.
              </div>
            )}

            {/* Evidence / Image Attachments */}
            <div className="space-y-2">
              <RequiredLabel htmlFor="attachments">Evidence</RequiredLabel>
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
                  Processing...
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
    </>
  );
}
