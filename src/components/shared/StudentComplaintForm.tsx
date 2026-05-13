"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Film,
  Globe2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
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
import { EvidenceCapture } from "@/components/shared/EvidenceCapture";
import { type NoiseReport } from "@/components/shared/NoiseAnalysis";

// ─── AI Evidence Validation Types ─────────────────────────────────────────────

interface BilingualVisionResult {
  match: boolean;
  detected_language: "English" | "Malay" | "Mixed";
  visual_keyword: string;
  explanation_en: string;
  explanation_ms: string;
  confidence: number;
  decision: "APPROVED" | "REJECTED";
  action: "Proceed to submission" | "Request new photo";
}

type EvidenceValidation = {
  fileName: string;
  status: "idle" | "validating" | "done" | "error";
  result: BilingualVisionResult | null;
};

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
type UploadedEvidence = { key: string; fileType: string; fileName: string };
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
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>(categories && categories.length > 0 ? categories : []);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories/active");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        
        let fetchedCategories = data.categories?.map((c: any) => ({
          value: c.name,
          label: c.name,
        })) || [];
        
        if (fetchedCategories.length === 0) {
          fetchedCategories = [
            { value: "Plumbing", label: "Plumbing" },
            { value: "Electrical", label: "Electrical" },
            { value: "Furniture", label: "Furniture" },
            { value: "WIFI", label: "WIFI" },
          ];
        }
        setCategoriesList(fetchedCategories);
        setCategory((prev) => {
            if (!prev || !fetchedCategories.find((c: any) => c.value === prev)) {
                return fetchedCategories[0].value;
            }
            return prev;
        });
      } catch (error) {
        console.error("[Category Fetch Error]", error);
        const fallbacks = [
          { value: "Plumbing", label: "Plumbing" },
          { value: "Electrical", label: "Electrical" },
          { value: "Furniture", label: "Furniture" },
          { value: "WIFI", label: "WIFI" },
        ];
        setCategoriesList(fallbacks);
        setCategory((prev) => prev || fallbacks[0].value);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const [locationFirst, setLocationFirst] = useState<string>("");
  const [locationSecond, setLocationSecond] = useState<string>("");
  const [locationThird, setLocationThird] = useState<string>("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("IDENTIFIED");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [noiseReport, setNoiseReport] = useState<NoiseReport | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({
    title: false,
    category: false,
    location: false,
    description: false,
  });

  // ── AI Evidence Validation State ──────────────────────────────────────────
  const [validations, setValidations] = useState<EvidenceValidation[]>([]);
  const validationInFlight = useRef<Set<string>>(new Set());

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

  // True if any image evidence was REJECTED by the AI
  const hasRejectedEvidence = validations.some(
    (v) => v.status === "done" && v.result?.decision === "REJECTED"
  );
  // True if any validation is still running
  const isValidating = validations.some((v) => v.status === "validating");

  // ── File → base64 data URI converter ──────────────────────────────────────
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  // ── Image Compressor ────────────────────────────────────────────────────────
  const compressImage = useCallback((file: File, maxWidth = 1024, maxHeight = 1024): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else if (height >= width && height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
           URL.revokeObjectURL(img.src);
           return resolve(file);
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src);
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.8);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file);
      };
    });
  }, []);

  // ── Trigger AI validation for a single image file ─────────────────────────
  const validateFile = useCallback(
    async (file: File) => {
      // Skip videos — only validate images
      if (!file.type.startsWith("image/")) return;
      // Skip if already validating this file
      if (validationInFlight.current.has(file.name)) return;
      // Skip if title or description aren't ready
      if (title.trim().length < 5 || description.trim().length < 20) return;

      validationInFlight.current.add(file.name);

      setValidations((prev) => {
        const existing = prev.find((v) => v.fileName === file.name);
        if (existing) {
          return prev.map((v) =>
            v.fileName === file.name
              ? { ...v, status: "validating" as const, result: null }
              : v
          );
        }
        return [...prev, { fileName: file.name, status: "validating", result: null }];
      });

      try {
        const compressedFile = await compressImage(file);
        const base64Url = await fileToBase64(compressedFile);

        const response = await fetch("/api/ai/vision-validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: base64Url,
            title: title.trim(),
            description: description.trim(),
            location: hostelName,
            category: category || undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Evidence Validation] HTTP ${response.status}: ${errorText}`);
          throw new Error(`Validation request failed: HTTP ${response.status} - ${errorText}`);
        }

        const result: BilingualVisionResult = await response.json();

        setValidations((prev) =>
          prev.map((v) =>
            v.fileName === file.name
              ? { ...v, status: "done" as const, result }
              : v
          )
        );
      } catch (error) {
        console.error("[Evidence Validation]", error);
        setValidations((prev) =>
          prev.map((v) =>
            v.fileName === file.name
              ? { ...v, status: "error" as const, result: null }
              : v
          )
        );
      } finally {
        validationInFlight.current.delete(file.name);
      }
    },
    [title, description, category, hostelName, fileToBase64, compressImage]
  );

  // ── Auto-trigger validation when files change and form is ready ───────────
  useEffect(() => {
    if (title.trim().length < 5 || description.trim().length < 20) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    for (const file of imageFiles) {
      const existing = validations.find((v) => v.fileName === file.name);
      // Only validate if not already validated or validating
      if (!existing || existing.status === "idle") {
        validateFile(file);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, title, description]);

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

    // Clear validations for removed files
    setValidations((prev) =>
      prev.filter((v) =>
        combined.some((f) => f.name === v.fileName)
      )
    );
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
            fileName: file.name,
          });
          uploadedKeys.push(String(uploadPayload.data.key));
        }

        for (const evidence of uploadedEvidence) {
            const validation = validations.find((v) => v.fileName === evidence.fileName);
            const aiVerified = validation?.status === "error" ? false : true;
            const manualReviewRequired = validation?.status === "error" ? true : false;

            const linkResponse = await fetch(`/api/complaints/${complaintId}/evidence`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: evidence.key,
                fileType: evidence.fileType,
                aiVerified,
                manualReviewRequired,
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
    <>
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
                disabled={isLoadingCategories}
              >
                <SelectTrigger
                  className={cn(
                    showCategoryError && "border-red-500 focus-visible:ring-red-500",
                    categoryValid && "border-emerald-500"
                  )}
                >
                  <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesList.map((item) => (
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
            <EvidenceCapture
              maxFiles={MAX_FILES}
              accept={ACCEPTED_TYPES}
              disabled={isSubmitting}
              locationBlock={locationFirst}
              onNoiseReport={(report) => setNoiseReport(report)}
              onFilesChange={(newFiles) => {
                setFiles(newFiles);
                setFileError("");
                // Clean up validations for removed files
                setValidations((prev) =>
                  prev.filter((v) => newFiles.some((f) => f.name === v.fileName))
                );
              }}
            />

            {fileError && (
              <p className="flex items-center gap-1 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {fileError}
              </p>
            )}

            {files.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="flex items-center justify-between">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles((prev) => prev.filter((f) => f.name !== file.name));
                        setValidations((prev) => prev.filter((v) => v.fileName !== file.name));
                      }}
                      className="ml-2 flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600 transition"
                      aria-label={`Remove ${file.name}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── AI Evidence Verification Cards ─────────────────────────── */}
            {validations.length > 0 && (
              <div className="space-y-3">
                {validations.map((validation) => (
                  <EvidenceVerificationCard
                    key={validation.fileName}
                    validation={validation}
                    onRetry={() => {
                      const file = files.find((f) => f.name === validation.fileName);
                      if (file) {
                        setValidations((prev) =>
                          prev.map((v) =>
                            v.fileName === file.name
                              ? { ...v, status: "idle" as const, result: null }
                              : v
                          )
                        );
                        validateFile(file);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Bilingual rejection warning */}
            {hasRejectedEvidence && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
                  <ShieldAlert className="h-4 w-4" />
                  Evidence rejected — please upload a new photo.
                </p>
                <p className="text-xs text-red-700">
                  Bukti ditolak — sila muat naik gambar baharu.
                </p>
              </div>
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
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto md:min-w-44"
                disabled={isSubmitting || hasRejectedEvidence || isValidating}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating Evidence...
                  </>
                ) : hasRejectedEvidence ? (
                  "Fix Rejected Evidence"
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}

// ─── Evidence Verification Card Component ─────────────────────────────────────

function EvidenceVerificationCard({
  validation,
  onRetry,
}: {
  validation: EvidenceValidation;
  onRetry: () => void;
}) {
  const { fileName, status, result } = validation;

  // ── Validating State ──────────────────────────────────────────────────────
  if (status === "validating") {
    return (
      <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-sky-100">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              AI Evidence Guard — Verifying...
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Analyzing <span className="font-medium">{fileName}</span> against your complaint description
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sky-400 to-indigo-400" />
        </div>
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Validation Error — {fileName}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                AI validation could not be completed. Your evidence will be reviewed manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Done State — Show Results ─────────────────────────────────────────────
  if (status !== "done" || !result) return null;

  const isApproved = result.decision === "APPROVED";
  const confidencePercent = Math.min(100, Math.max(0, result.confidence));

  const confidenceColor =
    confidencePercent >= 75
      ? "bg-emerald-500"
      : confidencePercent >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  const languageBadge: Record<string, { bg: string; text: string }> = {
    English: { bg: "bg-blue-100", text: "text-blue-800" },
    Malay: { bg: "bg-purple-100", text: "text-purple-800" },
    Mixed: { bg: "bg-teal-100", text: "text-teal-800" },
  };

  const langStyle = languageBadge[result.detected_language] ?? languageBadge.English;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-all duration-300",
        isApproved
          ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-green-50"
          : "border-red-200 bg-gradient-to-r from-red-50 via-white to-rose-50"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isApproved ? "bg-emerald-100" : "bg-red-100"
            )}
          >
            {isApproved ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  "text-sm font-bold",
                  isApproved ? "text-emerald-800" : "text-red-800"
                )}
              >
                {isApproved ? "APPROVED" : "REJECTED"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <Sparkles className="h-2.5 w-2.5" />
                AI Verified
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[260px]">
              {fileName}
            </p>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Confidence
          </p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              confidencePercent >= 75
                ? "text-emerald-700"
                : confidencePercent >= 50
                  ? "text-amber-700"
                  : "text-red-700"
            )}
          >
            {confidencePercent}%
          </p>
        </div>
      </div>

      {/* Confidence Progress Bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all duration-500", confidenceColor)}
          style={{ width: `${confidencePercent}%` }}
        />
      </div>

      {/* Tags Row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
            langStyle.bg,
            langStyle.text
          )}
        >
          <Globe2 className="h-3 w-3" />
          {result.detected_language}
        </span>
        {result.visual_keyword && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            🔍 {result.visual_keyword}
          </span>
        )}
      </div>

      {/* Bilingual Explanations */}
      <div className="mt-3 space-y-2">
        <div className="rounded-lg bg-white/80 border border-slate-200/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            English
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            {result.explanation_en}
          </p>
        </div>
        <div className="rounded-lg bg-white/80 border border-slate-200/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Bahasa Melayu
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            {result.explanation_ms}
          </p>
        </div>
      </div>

      {/* Retry Button for Rejected */}
      {!isApproved && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
          >
            Re-validate
          </button>
        </div>
      )}
    </div>
  );
}
