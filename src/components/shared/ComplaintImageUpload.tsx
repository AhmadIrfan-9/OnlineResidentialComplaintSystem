"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface UploadedFile {
  url: string;
  name: string;
}

interface ComplaintImageUploadProps {
  onImagesChange: (urls: string[]) => void;
  maxFiles?: number;
}

export function ComplaintImageUpload({
  onImagesChange,
  maxFiles = 5,
}: ComplaintImageUploadProps) {
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRemoveImage = (url: string) => {
    const filtered = uploaded.filter((file) => file.url !== url);
    setUploaded(filtered);
    onImagesChange(filtered.map((f) => f.url));
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handleSelectFiles = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files).slice(0, Math.max(0, maxFiles - uploaded.length));
    const newFiles = selected.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name || "uploaded-image",
    }));

    const combined = [...uploaded, ...newFiles];
    setUploaded(combined);
    onImagesChange(combined.map((f) => f.url));
  };

  useEffect(() => {
    return () => {
      for (const file of uploaded) {
        if (file.url.startsWith("blob:")) {
          URL.revokeObjectURL(file.url);
        }
      }
    };
  }, [uploaded]);

  const canUploadMore = uploaded.length < maxFiles;

  return (
    <div className="space-y-4">
      {canUploadMore && (
        <div
          className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            multiple
            className="hidden"
            onChange={(event) => handleSelectFiles(event.target.files)}
          />
          <p className="text-sm text-gray-700">Click to select image files</p>
          <p className="text-xs text-gray-500 mt-2">
            Local selection only - images will upload when complaint is submitted ({uploaded.length}/
            {maxFiles})
          </p>
        </div>
      )}

      {uploaded.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Uploaded Images ({uploaded.length})</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {uploaded.map((file) => (
              <div
                key={file.url}
                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
              >
                <Image src={file.url} alt={file.name} fill className="object-cover" />
                <button
                  onClick={() => handleRemoveImage(file.url)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploaded.length === 0 && !canUploadMore && (
        <div className="text-center text-gray-500 text-sm">Maximum number of images reached</div>
      )}
    </div>
  );
}
