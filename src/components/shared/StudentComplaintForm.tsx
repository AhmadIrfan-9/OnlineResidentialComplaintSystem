"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
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

type Severity = "ROUTINE" | "URGENT" | "EMERGENCY";
type Mode = "IDENTIFIED" | "ANONYMOUS";

interface CategoryOption {
  value: string;
  label: string;
}

interface StudentComplaintFormProps {
  categories: CategoryOption[];
  hostelName: string;
}

const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "video/mp4"];
const MIN_DESCRIPTION_LENGTH = 20;

export function StudentComplaintForm({
  categories,
  hostelName,
}: StudentComplaintFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<string>(categories[0]?.value ?? "");
  const [locationBlock, setLocationBlock] = useState("");
  const [severity, setSeverity] = useState<Severity>("ROUTINE");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("IDENTIFIED");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState({
    category: false,
    description: false,
    severity: false,
  });

  const descriptionCount = description.length;
  const categoryValid = category.trim().length > 0;
  const severityValid = severity === "ROUTINE" || severity === "URGENT" || severity === "EMERGENCY";
  const descriptionRequiredValid = description.trim().length > 0;
  const descriptionValid = descriptionCount >= MIN_DESCRIPTION_LENGTH;
  const formValid = categoryValid && severityValid && descriptionValid;

  const helperText = useMemo(
    () =>
      "Routine = 7 days, Urgent = 24 hours, Emergency = 4 hours",
    []
  );

  const showCategoryError = (attemptedSubmit || touched.category) && !categoryValid;
  const showSeverityError = (attemptedSubmit || touched.severity) && !severityValid;
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);

    if (!formValid) {
      setSubmitMessage("");
      return;
    }

    setSubmitMessage(
      mode === "ANONYMOUS"
        ? "Anonymous complaint draft is ready to submit."
        : "Identified complaint draft is ready to submit."
    );
  };

  const handleSaveAsDraft = () => {
    const draft = {
      category,
      locationBlock,
      severity,
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

          <div className="space-y-2">
            <Label htmlFor="locationBlock">Location / Block (Optional)</Label>
            <Input
              id="locationBlock"
              placeholder="Example: Block B, 3rd Floor Corridor"
              value={locationBlock}
              onChange={(event) => setLocationBlock(event.target.value)}
            />
          </div>

          <div
            className={cn(
              "space-y-3 rounded-xl border bg-slate-50 p-4",
              showSeverityError ? "border-red-500" : "border-slate-200",
              severityValid && "border-emerald-500"
            )}
          >
            <div className="flex items-center justify-between">
              <Label>Severity</Label>
              {severityValid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { value: "ROUTINE", label: "Routine" },
                { value: "URGENT", label: "Urgent" },
                { value: "EMERGENCY", label: "Emergency" },
              ].map((item) => (
                <label key={item.value} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="severity"
                    value={item.value}
                    checked={severity === item.value}
                    onChange={() => {
                      setSeverity(item.value as Severity);
                      setTouched((prev) => ({ ...prev, severity: true }));
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-600">{helperText}</p>
            {showSeverityError && (
              <p className="text-xs text-red-600">This field is required</p>
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
              <p className="inline-flex items-center gap-1 text-sm text-emerald-700">
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
              <Button type="submit" size="lg" className="w-full md:w-auto md:min-w-44">
                Submit
              </Button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
