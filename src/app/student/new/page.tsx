"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Paperclip, Video } from "lucide-react";

type ComplaintFormData = {
  category: string;
  location: string;
  severity: "ROUTINE" | "URGENT" | "EMERGENCY";
  description: string;
  contactMethods: {
    email: boolean;
    sms: boolean;
    phone: boolean;
    anonymous: boolean;
  };
  anonymousMode: boolean;
};

const INITIAL_FORM: ComplaintFormData = {
  category: "",
  location: "",
  severity: "ROUTINE",
  description: "",
  contactMethods: {
    email: true,
    sms: false,
    phone: false,
    anonymous: false,
  },
  anonymousMode: false,
};

export default function NewComplaintPage() {
  const [formData, setFormData] = useState<ComplaintFormData>(INITIAL_FORM);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const maxDescriptionChars = 500;
  const descriptionCount = formData.description.length;
  const remaining = maxDescriptionChars - descriptionCount;
  const selectedFilesText = useMemo(() => {
    if (selectedFiles.length === 0) return "No files selected";
    if (selectedFiles.length === 1) return selectedFiles[0].name;
    return `${selectedFiles.length} files selected`;
  }, [selectedFiles]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("Mock complaint submission:", {
      ...formData,
      files: selectedFiles.map((file) => file.name),
    });
    alert("Complaint submitted successfully (Mock Mode)");
    setFormData(INITIAL_FORM);
    setSelectedFiles([]);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-200 to-slate-300 p-4 md:p-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-100/95 p-6 shadow-xl md:p-8">
        <h1 className="mb-8 text-center text-4xl font-bold tracking-tight text-slate-800">
          Submit a Complaint
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <label className="text-sm font-semibold text-slate-700">Category</label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger className="h-11 bg-white">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="PLUMBING">Plumbing</SelectItem>
                <SelectItem value="ELECTRICAL">Electrical</SelectItem>
                <SelectItem value="WIFI">WiFi / Internet</SelectItem>
                <SelectItem value="CLEANLINESS">Cleanliness</SelectItem>
                <SelectItem value="SECURITY">Security</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className="text-sm font-semibold text-slate-700">Hostel</span>
            <input
              className="h-11 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              value="Auto-populated: Hostel A"
              disabled
              readOnly
            />
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <label className="text-sm font-semibold text-slate-700">
              Location/Hostel
            </label>
            <Select
              value={formData.location}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, location: value }))
              }
            >
              <SelectTrigger className="h-11 bg-white">
                <SelectValue placeholder="Location/Hostel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOSTEL_A_BLOCK_A">Hostel A - Block A</SelectItem>
                <SelectItem value="HOSTEL_A_BLOCK_B">Hostel A - Block B</SelectItem>
                <SelectItem value="HOSTEL_A_CAFETERIA">Hostel A - Cafeteria</SelectItem>
                <SelectItem value="HOSTEL_A_TOILET">Hostel A - Shared Toilet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className="text-sm font-semibold text-slate-700">Severity level</span>
            <div className="flex flex-wrap gap-6 pt-1 text-sm text-slate-700">
              {[
                { value: "ROUTINE", label: "Routine" },
                { value: "URGENT", label: "Urgent" },
                { value: "EMERGENCY", label: "Emergency" },
              ].map((item) => (
                <label key={item.value} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="severity"
                    value={item.value}
                    checked={formData.severity === item.value}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        severity: event.target.value as ComplaintFormData["severity"],
                      }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr]">
            <label htmlFor="description" className="pt-2 text-sm font-semibold text-slate-700">
              Description
            </label>
            <div className="space-y-2">
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: event.target.value.slice(0, maxDescriptionChars),
                  }))
                }
                placeholder="Describe your complaint in detail..."
                className="min-h-28 bg-white"
              />
              <p className="text-right text-xs text-slate-500">
                {descriptionCount}/{maxDescriptionChars} characters
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-start">
            <span className="text-sm font-semibold text-slate-700">Attachments</span>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files ?? []))
                }
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Choose File
              </Button>
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Paperclip className="h-3.5 w-3.5" />
                <ImageIcon className="h-3.5 w-3.5" />
                <Video className="h-3.5 w-3.5" />
                {selectedFilesText}
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-start">
            <span className="text-sm font-semibold text-slate-700">Contact method</span>
            <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-700">
              {[
                { key: "email", label: "Email" },
                { key: "sms", label: "SMS" },
                { key: "phone", label: "Phone" },
                { key: "anonymous", label: "Anonymous" },
              ].map((item) => (
                <label key={item.key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      formData.contactMethods[
                        item.key as keyof ComplaintFormData["contactMethods"]
                      ]
                    }
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        contactMethods: {
                          ...prev.contactMethods,
                          [item.key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 pt-1 md:grid-cols-[160px_1fr] md:items-center">
            <span className="text-sm font-semibold text-slate-700">Submission mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.anonymousMode}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  anonymousMode: !prev.anonymousMode,
                }))
              }
              className={`relative h-8 w-14 rounded-full transition ${
                formData.anonymousMode ? "bg-blue-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                  formData.anonymousMode ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="pt-5 text-center">
            <Button
              type="submit"
              className="h-11 min-w-40 bg-blue-500 text-base font-semibold hover:bg-blue-600"
            >
              Submit
            </Button>
          </div>
          <p className="text-center text-xs text-slate-500">
            {remaining >= 0 ? `${remaining} characters remaining` : "Character limit exceeded"}
          </p>
        </form>
      </section>
    </main>
  );
}
