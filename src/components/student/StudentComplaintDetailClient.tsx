"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addComplaintComment, updateComplaint, deleteComplaint } from "@/actions/complaints";

import { Loader2 } from "lucide-react";

interface CategoryOption {
  value: string;
  label: string;
}

interface Props {
  complaintId: string;
  status: string;
  initialTitle: string;
  initialDescription: string;
  initialCategory: string;
  initialAnonymous: boolean;
  initialAttachments: string[];
  location: string;
}

const EDITABLE_STATUSES = new Set(["PENDING"]);

export function StudentComplaintDetailClient({
  complaintId,
  status,
  initialTitle,
  initialDescription,
  initialCategory,
  initialAnonymous,
  initialAttachments,
  location,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState<string>(initialCategory);
  const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
  const [attachmentUrls, setAttachmentUrls] = useState(initialAttachments.join(", "));
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const canEdit = EDITABLE_STATUSES.has(status);

  const [showDelete, setShowDelete] = useState(false);

  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
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
            { value: "WiFi", label: "WiFi" },
            { value: "Electrical", label: "Electrical" },
            { value: "Furniture", label: "Furniture" },
            { value: "Water", label: "Water" },
            { value: "Noise", label: "Noise" },
            { value: "Security", label: "Security" },
            { value: "Others", label: "Others" },
          ];
        }
        setCategoriesList(fetchedCategories);
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
        setCategoriesList(fallbacks);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const normalizedCategoryValue = useMemo(() => {
    if (!category) return "";
    const catLower = category.toLowerCase().trim();
    if (catLower === "other" || catLower === "others") {
      return "Others";
    }
    const matched = categoriesList.find(
      (c) => c.value.toLowerCase() === catLower
    );
    return matched ? matched.value : category;
  }, [category, categoriesList]);

  const sendMessage = () => {
    if (message.trim().length < 2) {
      setFeedback("Message must be at least 2 characters.");
      return;
    }

    startTransition(async () => {
      const result = await addComplaintComment(complaintId, message);
      if (!result.success) {
        setFeedback(result.error ?? "Failed to send message.");
        return;
      }
      setMessage("");
      setFeedback("Message sent.");
      router.refresh();
    });
  };

  const saveChanges = () => {
    setFeedback("");
    startTransition(async () => {
      try {
        const urls = attachmentUrls
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean);

        // Pre-Validation: Evidence Integrity Guard
        if (urls.length > 0) {
          for (const url of urls) {
            // Check if it's a new URL or existing
            if (!initialAttachments.includes(url)) {
              const validationRes = await fetch("/api/ai/vision-validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  imageUrl: url,
                  title: title,
                  description: description,
                  location: location,
                }),
              });

              if (!validationRes.ok) {
                const errData = await validationRes.json();
                throw new Error(errData.error || "Image validation service failed.");
              }

              const aiResult = await validationRes.json();
              if (aiResult.decision === "REJECTED") {
                throw new Error(`Evidence Rejected: ${aiResult.rejection_reason} (AI Confidence: ${aiResult.confidence_score}%)`);
              }
            }
          }
        }

        const result = await updateComplaint({
          id: complaintId,
          title,
          description,
          category,
          isAnonymous,
          attachments: urls,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to update complaint.");
        }

        setEditing(false);
        setFeedback("Complaint updated successfully.");
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  const handleDelete = () => {
    setShowDelete(true);
  };

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteComplaint(complaintId);
        if (!result.success) {
          throw new Error(result.error || "Failed to delete complaint.");
        }
        setShowDelete(false);
        router.push("/dashboard/student");
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "An unexpected error occurred.");
        setShowDelete(false);
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="surface-card p-4">
        <h2 className="text-base font-semibold text-slate-900">Complaint actions</h2>
        <p className="mt-1 text-sm text-slate-600">
          Editable only while status is Pending.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-sky-50 disabled:opacity-50"
            onClick={() => setEditing((prev) => !prev)}
            disabled={!canEdit || isPending}
          >
            {editing ? "Cancel Edit" : "Edit Complaint"}
          </button>
          <button
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
            onClick={handleDelete}
            disabled={!canEdit || isPending}
          >
            Delete Complaint
          </button>
        </div>
        {editing ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3">
            {feedback && (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {feedback}
              </div>
            )}
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Complaint Title"
            />
            <textarea
              className="min-h-28 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed Description"
            />
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              value={attachmentUrls}
              onChange={(e) => setAttachmentUrls(e.target.value)}
              placeholder="https://example.com/image.jpg (comma-separated for multiple)"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Category / Kategori</Label>
                <Select
                  value={normalizedCategoryValue}
                  onValueChange={(value) => setCategory(value)}
                  disabled={isLoadingCategories}
                >
                  <SelectTrigger className="border-slate-300 bg-slate-50 text-slate-900 focus-visible:ring-1 focus-visible:ring-sky-500">
                    <SelectValue placeholder={isLoadingCategories ? "Loading..." : "-Please select-"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950">
                    {categoriesList.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Visibility / Kebolehlihatan</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  Anonymous / Tanpa Nama
                </label>
              </div>
            </div>
            <button
              className="w-fit flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={saveChanges}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        ) : null}
      </div>

      <div className="surface-card p-4">
        <h2 className="text-base font-semibold text-slate-900">Message management</h2>
        <textarea
          className="mt-3 min-h-28 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          placeholder="Ask for updates or provide more details..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={sendMessage}
            disabled={isPending}
          >
            Send Message
          </button>
        </div>
        {feedback ? <p className="mt-2 text-sm text-slate-600">{feedback}</p> : null}
      </div>

      {/* ── Delete Complaint Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogTitle>Confirm Delete Complaint</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete ticket <span className="font-semibold text-slate-800">#{complaintId.slice(0, 8).toUpperCase()}</span>? 
            This action cannot be undone.
            <br/><br/>
            Adakah anda pasti? Tindakan ini tidak boleh diundur.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setShowDelete(false)}
              disabled={isPending}
            >
              Cancel / Batal
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete / Padam"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
