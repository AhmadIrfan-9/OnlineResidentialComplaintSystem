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

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const uploaded = await storageService.putObject({
      complaintId,
      fileUuid,
      extension,
      body: fileBuffer,
      contentType: fileData.type || "application/octet-stream",
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
