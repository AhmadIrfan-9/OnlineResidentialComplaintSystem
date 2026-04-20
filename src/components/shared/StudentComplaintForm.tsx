"use client";

import { FormEvent, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileImage, Film, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type Mode = "IDENTIFIED" | "ANONYMOUS";

interface CategoryOption {
  value: string;
  label: string;
}

interface StudentComplaintFormProps {
  categories: CategoryOption[];
  hostelName: string;
  roomId: string;
}

const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "video/mp4"];
const MIN_DESCRIPTION_LENGTH = 20;
const LOCATION_FIRST_OPTIONS = ["C1", "C2", "C3"] as const;
const LOCATION_SECOND_OPTIONS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
] as const;
const LOCATION_THIRD_OPTIONS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
type UploadedEvidence = { key: string; fileType: string };
const parseEvidenceKey = (key: string): { complaintId: string; fileUuid: string; ext: string } | null => {
  const match = key.match(
    /^([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9]{1,16})$/i
  );
  if (!match) return null;
  return {
    complaintId: match[1],
    fileUuid: match[2],
    ext: match[3].toLowerCase(),
  };
};

export function StudentComplaintForm({
  categories,
  hostelName,
  roomId,
}: StudentComplaintFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(categories[0]?.value ?? "");
  const [locationFirst, setLocationFirst] = useState<string>("");
  const [locationSecond, setLocationSecond] = useState<string>("");
  const [locationThird, setLocationThird] = useState<string>("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("IDENTIFIED");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({
    title: false,
    category: false,
    location: false,
    description: false,
  });

  const titleValid = title.trim().length >= 5;
  const descriptionCount = description.length;
  const categoryValid = category.trim().length > 0;
  const locationValid =
    LOCATION_FIRST_OPTIONS.includes(locationFirst as (typeof LOCATION_FIRST_OPTIONS)[number]) &&
    LOCATION_SECOND_OPTIONS.includes(
      locationSecond as (typeof LOCATION_SECOND_OPTIONS)[number]
    ) &&
    LOCATION_THIRD_OPTIONS.includes(locationThird as (typeof LOCATION_THIRD_OPTIONS)[number]);
  const locationBlock = locationValid
    ? `${locationFirst}-${locationSecond}-${locationThird}`
    : "";
  const descriptionRequiredValid = description.trim().length > 0;
  const descriptionValid = descriptionCount >= MIN_DESCRIPTION_LENGTH;
  const formValid = titleValid && categoryValid && locationValid && descriptionValid;

  const showTitleError = (attemptedSubmit || touched.title) && !titleValid;
  const showCategoryError = (attemptedSubmit || touched.category) && !categoryValid;
  const showLocationError = (attemptedSubmit || touched.location) && !locationValid;
  const showDescriptionRequiredError =
    (attemptedSubmit || touched.description) && !descriptionRequiredValid;
  const showDescriptionMinError =
    (attemptedSubmit || touched.description) &&
    descriptionRequiredValid &&
    !descriptionValid;

  const applyFiles = (incoming: FileList | null) => {
    if (!incoming) return;

    const selected = Array.from(incoming);
    const validated: File[] = [];

    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFileError("Only JPEG, PNG, or MP4 files are accepted.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError("Each file must be 10MB or smaller.");
        continue;
      }
      validated.push(file);
    }

    const combined = [...files, ...validated].slice(0, MAX_FILES);

    if (validated.length > 0 && combined.length >= MAX_FILES && selected.length > MAX_FILES) {
      setFileError("Maximum of 3 files allowed.");
    } else if (validated.length > 0) {
      setFileError("");
    }

    setFiles(combined);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    applyFiles(event.dataTransfer.files);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    setSubmitMessage("");

    if (!formValid) {
      return;
    }

    const uploadedKeys: string[] = [];
    const linkedKeys = new Set<string>();

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          locationBlock,
          roomId,
          attachments: [],
          isAnonymous: mode === "ANONYMOUS",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setSubmitMessage(payload.message || "Failed to submit complaint.");
        setIsSubmitting(false);
        return;
      }

      const complaintId = String(payload?.id ?? "").trim();
      if (!complaintId) {
        setSubmitMessage("Complaint created but missing complaint id in response.");
        setIsSubmitting(false);
        return;
      }

      const uploadedEvidence: UploadedEvidence[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          uploadFormData.append("complaintId", complaintId);
          uploadFormData.append("virusScanStatus", "PENDING");

          const uploadResponse = await fetch("/api/storage/evidence", {
            method: "PUT",
            body: uploadFormData,
          });
          const uploadPayload = await uploadResponse.json();

          if (!uploadResponse.ok || !uploadPayload?.data?.key) {
            throw new Error(uploadPayload?.message ?? "Failed to upload evidence file.");
          }

          uploadedEvidence.push({
            key: String(uploadPayload.data.key),
            fileType: file.type || "application/octet-stream",
          });
          uploadedKeys.push(String(uploadPayload.data.key));
        }

        for (const evidence of uploadedEvidence) {
          const linkResponse = await fetch(`/api/complaints/${complaintId}/evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: evidence.key,
              fileType: evidence.fileType,
            }),
          });

          if (!linkResponse.ok) {
            const linkPayload = await linkResponse.json();
            throw new Error(linkPayload?.message ?? "Failed to link uploaded evidence.");
          }
          linkedKeys.add(evidence.key);
        }
      }

      setSubmitMessage("Complaint submitted successfully.");
      router.push(`/complaints/${complaintId}`);
      router.refresh();
    } catch (error) {
      // Best-effort cleanup of uploaded but unlinked objects.
      const rollbackTargets = uploadedKeys.filter((key) => !linkedKeys.has(key));
      await Promise.all(
        rollbackTargets.map(async (key) => {
          const parsed = parseEvidenceKey(key);
          if (!parsed) return;
          const query = new URLSearchParams({
            complaintId: parsed.complaintId,
            fileUuid: parsed.fileUuid,
            ext: parsed.ext,
          });
          try {
            await fetch(`/api/storage/evidence?${query.toString()}`, { method: "DELETE" });
          } catch {
            // no-op best-effort rollback
          }
        })
      );
      setSubmitMessage(
        error instanceof Error ? error.message : "Failed to submit complaint."
      );
      setIsSubmitting(false);
    }
  };

  const handleSaveAsDraft = () => {
    const draft = {
      title,
      category,
      locationBlock,
      description,
      mode,
      files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem("studentComplaintDraft", JSON.stringify(draft));
    setSubmitMessage("Draft saved successfully.");
  };

  const handleCancel = () => {
    router.push("/dashboard/student");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
            Submit Complaint
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Provide clear details so management can resolve your issue faster.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Title</Label>
              {titleValid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
            <Input
              id="title"
              placeholder="Brief complaint title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
              className={cn(
                showTitleError && "border-red-500 focus-visible:ring-red-500",
                titleValid && "border-emerald-500"
              )}
            />
            {showTitleError && (
              <p className="text-xs text-red-600">This field is required</p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                {categoryValid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </div>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setTouched((prev) => ({ ...prev, category: true }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    showCategoryError && "border-red-500 focus-visible:ring-red-500",
                    categoryValid && "border-emerald-500"
                  )}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showCategoryError && (
                <p className="text-xs text-red-600">This field is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Hostel</Label>
              <Input value={hostelName} readOnly disabled />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <Label>Location / Block</Label>
              {locationValid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={locationFirst}
                onValueChange={(value) => {
                  setLocationFirst(value);
                  setTouched((prev) => ({ ...prev, location: true }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    showLocationError && "border-red-500 focus-visible:ring-red-500",
                    locationFirst && "border-emerald-500"
                  )}
                >
                  <SelectValue placeholder="First" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_FIRST_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={locationSecond}
                onValueChange={(value) => {
                  setLocationSecond(value);
                  setTouched((prev) => ({ ...prev, location: true }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    showLocationError && "border-red-500 focus-visible:ring-red-500",
                    locationSecond && "border-emerald-500"
                  )}
                >
                  <SelectValue placeholder="Second" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_SECOND_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={locationThird}
                onValueChange={(value) => {
                  setLocationThird(value);
                  setTouched((prev) => ({ ...prev, location: true }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    showLocationError && "border-red-500 focus-visible:ring-red-500",
                    locationThird && "border-emerald-500"
                  )}
                >
                  <SelectValue placeholder="Third" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_THIRD_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-600">
              Selected format: {locationBlock || "first-second-third"}
            </p>
            {showLocationError && (
              <p className="text-xs text-red-600">Please select all three location values</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              {descriptionValid && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <Textarea
              id="description"
              rows={6}
              placeholder="Describe the issue clearly, including when it started and impact."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, description: true }))
              }
              className={cn(
                (showDescriptionRequiredError || showDescriptionMinError) &&
                  "border-red-500 focus-visible:ring-red-500",
                descriptionValid && "border-emerald-500"
              )}
            />
            {showDescriptionRequiredError && (
              <p className="text-xs text-red-600">This field is required</p>
            )}
            {showDescriptionMinError && (
              <p className="text-xs text-red-600">Minimum 20 characters</p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className={descriptionValid ? "text-emerald-700" : "text-amber-700"}>
                Minimum {MIN_DESCRIPTION_LENGTH} characters required
              </span>
              <span className="text-slate-500">{descriptionCount} characters</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Evidence Files</Label>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-slate-100"
            >
              <UploadCloud className="mx-auto h-7 w-7 text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                Drag and drop files here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Maximum 3 files, 10MB each
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                <FileImage className="h-3.5 w-3.5" />
                <Film className="h-3.5 w-3.5" />
                JPEG, PNG, MP4 accepted
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.mp4"
                className="hidden"
                onChange={(event) => applyFiles(event.target.files)}
              />
            </div>

            {fileError && (
              <p className="flex items-center gap-1 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {fileError}
              </p>
            )}

            {files.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Label>Submission Mode</Label>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setMode("IDENTIFIED")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  mode === "IDENTIFIED"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Identified
              </button>
              <button
                type="button"
                onClick={() => setMode("ANONYMOUS")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  mode === "ANONYMOUS"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Anonymous
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {mode === "IDENTIFIED"
                ? "Your name visible to management"
                : "Your name hidden; access via code sent to email"}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {submitMessage ? (
              <p className={cn(
                "inline-flex items-center gap-1 text-sm",
                submitMessage.toLowerCase().includes("success") || submitMessage.toLowerCase().includes("saved")
                  ? "text-emerald-700"
                  : "text-red-700"
              )}>
                <CheckCircle2 className="h-4 w-4" />
                {submitMessage}
              </p>
            ) : (
              <span />
            )}
            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <Button type="button" variant="outline" onClick={handleCancel} className="w-full md:w-auto">
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={handleSaveAsDraft} className="w-full md:w-auto">
                Save as Draft
              </Button>
              <Button type="submit" size="lg" className="w-full md:w-auto md:min-w-44" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
