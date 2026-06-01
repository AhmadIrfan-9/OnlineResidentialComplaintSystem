"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Film,
  Globe2,
  Loader2,
  Search,
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

const BLOCKS = ["C1", "C2", "C3"];
const FLOORS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));
const UNITS  = Array.from({ length: 8  }, (_, i) => String(i + 1).padStart(2, "0"));

const ALL_ROOM_LABELS: string[] = BLOCKS.flatMap(b =>
  FLOORS.flatMap(f => UNITS.map(u => `${b}-${f}-${u}`))
); // 240 rooms total

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

// ── Searchable Room Combobox ──────────────────────────────────────────────────
function RoomCombobox({ value, onChange, isError }: { value: string; onChange: (v: string) => void; isError?: boolean }) {
  const [query, setQuery]   = useState(value);
  const [open, setOpen]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q.length === 0 ? ALL_ROOM_LABELS.slice(0, 40) : ALL_ROOM_LABELS.filter(r => r.includes(q)).slice(0, 40);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (room: string) => { onChange(room); setQuery(room); setOpen(false); };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className={cn("w-full rounded-lg border bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all", isError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20")}
          placeholder='Search room (e.g. C2-04-01)…'
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
            {value}
          </span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {filtered.map(room => (
            <button
              key={room}
              type="button"
              onClick={() => select(room)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-sky-50 hover:text-sky-700 transition-colors font-mono ${room === value ? "bg-sky-50 font-bold text-sky-700" : "text-slate-700"}`}
            >
              {room}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentComplaintForm({
  categories,
  hostelName,
  roomId,
}: StudentComplaintFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>(categories && categories.length > 0 ? categories : []);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      const arrangeCategories = (list: CategoryOption[]) => {
        const others = list.find((c) => c.value.toLowerCase().includes("other"));
        const rest = list.filter((c) => !c.value.toLowerCase().includes("other"));
        rest.sort((a, b) => a.label.localeCompare(b.label));
        if (others) {
          rest.push(others);
        }
        return rest;
      };

      try {
        const res = await fetch("/api/categories/active");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Invalid response format: expected JSON");
        }
        
        const data = await res.json();
        
        let fetchedCategories = data.categories?.map((c: any) => ({
          value: c.name,
          label: c.name,
        })) || [];
        
        if (fetchedCategories.length === 0) {
          fetchedCategories = [
            { value: "Plumbing", label: "Plumbing" },
            { value: "WiFi", label: "WiFi" },
            { value: "Electrical", label: "Electrical" },
            { value: "Furniture", label: "Furniture" },
            { value: "Water", label: "Water" },
            { value: "Noise", label: "Noise" },
            { value: "Security", label: "Security" },
            { value: "Others", label: "Others" },
          ];
        }

        const sortedList = arrangeCategories(fetchedCategories);
        setCategoriesList(sortedList);
        setCategory((prev) => {
            if (prev && sortedList.find((c: any) => c.value === prev)) {
                return prev;
            }
            return "";
        });
      } catch (error) {
        console.error("[Category Fetch Error]", error);
        const fallbacks = [
          { value: "Plumbing", label: "Plumbing" },
          { value: "WiFi", label: "WiFi" },
          { value: "Electrical", label: "Electrical" },
          { value: "Furniture", label: "Furniture" },
          { value: "Water", label: "Water" },
          { value: "Noise", label: "Noise" },
          { value: "Security", label: "Security" },
          { value: "Others", label: "Others" },
        ];
        const sortedList = arrangeCategories(fallbacks);
        setCategoriesList(sortedList);
        setCategory((prev) => {
            if (prev && sortedList.find((c: any) => c.value === prev)) {
                return prev;
            }
            return "";
        });
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const [locationBlock, setLocationBlock] = useState<string>("");
  const [roomNumber, setRoomNumber] = useState<string>("");
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

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setFileError("");
  }, []);

  const handleNoiseReport = useCallback((report: NoiseReport | null) => {
    setNoiseReport(report);
  }, []);

  const titleValid = title.trim().length >= 5;
  const descriptionCount = description.length;
  const categoryValid = category.trim().length > 0;
  const locationValid = ALL_ROOM_LABELS.includes(locationBlock);
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
          locationBlock: roomNumber && roomNumber !== "none" ? `${locationBlock} (Room ${roomNumber})` : locationBlock,
          roomId,
          attachments: [],
          isAnonymous: mode === "ANONYMOUS",
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setSubmitMessage("Your session has expired. Please refresh the page and log in again.");
        setIsSubmitting(false);
        return;
      }

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
            const linkResponse = await fetch(`/api/complaints/${complaintId}/evidence`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: evidence.key,
                fileType: evidence.fileType,
                aiVerified: false,
                manualReviewRequired: false,
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
                value={category || ""}
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
                  <SelectValue placeholder={isLoadingCategories ? "Loading..." : "-Please select-"} />
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
              <Select value={hostelName || ""} onValueChange={() => {}}>
                <SelectTrigger className="border-slate-300">
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={hostelName}>{hostelName}</SelectItem>
                  {["Cendikiawan", "Ilmu", "Murni", "Amanah"]
                    .filter((h) => h.toLowerCase() !== hostelName.toLowerCase())
                    .map((h) => (
                      <SelectItem key={h} value={h} disabled>
                        {h} (Coming Soon)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Unit</Label>
                  {locationValid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <RoomCombobox 
                  value={locationBlock} 
                  onChange={(v) => {
                    setLocationBlock(v);
                    setTouched((prev) => ({ ...prev, location: true }));
                  }}
                  isError={showLocationError}
                />
                {showLocationError && (
                  <p className="text-xs text-red-600 mt-1">Please select a valid unit assignment</p>
                )}
              </div>
              
              <div>
                <Label className="mb-2 block">Room (Optional)</Label>
                <Select value={roomNumber || ""} onValueChange={(val) => setRoomNumber(val)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              locationBlock={locationBlock}
              onNoiseReport={handleNoiseReport}
              onFilesChange={handleFilesChange}
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
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
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


