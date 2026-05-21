import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  StorageServiceError,
  storageService,
} from "@/lib/storage/StorageService";

export const runtime = "nodejs";

const getRequiredQueryParam = (
  params: URLSearchParams,
  key: "complaintId" | "fileUuid" | "ext"
): string => {
  const value = params.get(key)?.trim();
  if (!value) {
    throw new StorageServiceError(`Missing required query parameter: ${key}`, 400, "BAD_INPUT");
  }
  return value;
};

const mapStorageError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof StorageServiceError) {
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  console.error("[Storage API Error]", error);
  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
};

const getExtensionFromFilename = (filename: string): string | null => {
  const parts = filename.split(".");
  if (parts.length < 2) return null;
  return parts.pop()?.trim() || null;
};

const isFileLike = (value: unknown): value is File =>
  typeof value === "object" &&
  value !== null &&
  "arrayBuffer" in value &&
  "size" in value &&
  "name" in value;

// Allowed evidence file types with their magic byte signatures.
const ALLOWED_TYPES: { ext: string; mimeType: string; magic: number[] }[] = [
  { ext: "jpg",  mimeType: "image/jpeg",       magic: [0xff, 0xd8, 0xff] },
  { ext: "jpeg", mimeType: "image/jpeg",       magic: [0xff, 0xd8, 0xff] },
  { ext: "png",  mimeType: "image/png",        magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "webp", mimeType: "image/webp",       magic: [0x52, 0x49, 0x46, 0x46] },   // RIFF header; WebP verified below
  { ext: "gif",  mimeType: "image/gif",        magic: [0x47, 0x49, 0x46, 0x38] },   // GIF8
  { ext: "pdf",  mimeType: "application/pdf",  magic: [0x25, 0x50, 0x44, 0x46] },   // %PDF
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function detectMimeType(buf: Buffer): string | null {
  for (const { mimeType, magic } of ALLOWED_TYPES) {
    if (magic.every((byte, i) => buf[i] === byte)) {
      // Extra check: RIFF files must have "WEBP" at bytes 8-11
      if (mimeType === "image/webp") {
        if (buf.slice(8, 12).toString("ascii") !== "WEBP") continue;
      }
      return mimeType;
    }
  }
  return null;
}

function isAllowedExtension(ext: string): boolean {
  return ALLOWED_TYPES.some((t) => t.ext === ext.toLowerCase());
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const fileData = formData.get("file");
    const complaintId = String(formData.get("complaintId") ?? "").trim();
    const uploaderId = String(formData.get("uploaderId") ?? session.user.id).trim();
    const fileUuid = String(formData.get("fileUuid") ?? randomUUID()).trim();
    const virusScanStatus = String(formData.get("virusScanStatus") ?? "PENDING")
      .trim()
      .toUpperCase();
    const explicitExt = String(formData.get("ext") ?? "").trim();

    if (!complaintId) {
      return NextResponse.json({ message: "Missing complaintId" }, { status: 400 });
    }
    if (!isFileLike(fileData)) {
      return NextResponse.json({ message: "Missing file in form-data" }, { status: 400 });
    }

    const extension = explicitExt || getExtensionFromFilename(fileData.name);
    if (!extension) {
      return NextResponse.json(
        { message: "Missing extension. Provide ext or a filename with extension." },
        { status: 400 }
      );
    }

    if (!isAllowedExtension(extension)) {
      return NextResponse.json(
        { message: "File type not allowed. Accepted: JPG, PNG, WebP, GIF, PDF." },
        { status: 415 }
      );
    }

    if (fileData.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    const detectedMime = detectMimeType(fileBuffer);
    if (!detectedMime) {
      return NextResponse.json(
        { message: "File content does not match an allowed type. Accepted: JPG, PNG, WebP, GIF, PDF." },
        { status: 415 }
      );
    }

    const uploaded = await storageService.putObject({
      complaintId,
      fileUuid,
      extension,
      body: fileBuffer,
      contentType: detectedMime,
      fileSize: fileData.size,
      uploaderId,
      virusScanStatus:
        virusScanStatus === "CLEAN" ||
        virusScanStatus === "INFECTED" ||
        virusScanStatus === "FAILED"
          ? virusScanStatus
          : "PENDING",
    });

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        data: uploaded,
      },
      { status: 201 }
    );
  } catch (error) {
    return mapStorageError(error, "Failed to upload file");
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const complaintId = getRequiredQueryParam(searchParams, "complaintId");
    const fileUuid = getRequiredQueryParam(searchParams, "fileUuid");
    const ext = getRequiredQueryParam(searchParams, "ext");
    const expiresIn = Number.parseInt(searchParams.get("expiresIn") ?? "300", 10);

    const [signed, metadata] = await Promise.all([
      storageService.getSignedGetUrl(complaintId, fileUuid, ext, expiresIn),
      storageService.getObjectMetadata(complaintId, fileUuid, ext),
    ]);

    return NextResponse.json({
      message: "Signed URL generated",
      data: {
        ...signed,
        metadata: metadata.metadata,
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        lastModified: metadata.lastModified,
      },
    });
  } catch (error) {
    return mapStorageError(error, "Failed to retrieve file access URL");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const complaintId = getRequiredQueryParam(searchParams, "complaintId");
    const fileUuid = getRequiredQueryParam(searchParams, "fileUuid");
    const ext = getRequiredQueryParam(searchParams, "ext");

    const deleted = await storageService.deleteObject(complaintId, fileUuid, ext);

    return NextResponse.json({
      message: "File deleted",
      data: deleted,
    });
  } catch (error) {
    return mapStorageError(error, "Failed to delete file");
  }
}
