"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Expand } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ComplaintImageGridProps {
  images: string[];
  title?: string;
}

export function ComplaintImageGrid({
  images,
  title = "Complaint Images",
}: ComplaintImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <p>No images attached to this complaint</p>
      </Card>
    );
  }

  return (
    <>
      <div>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image}
                alt="Complaint attachment"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Expand className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Image Preview</DialogTitle>
          {selectedImage && (
            <div className="relative w-full aspect-auto">
              <Image
                src={selectedImage}
                alt="Full size preview"
                width={800}
                height={600}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
