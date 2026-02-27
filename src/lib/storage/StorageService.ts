import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";

type VirusScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "FAILED";

type StorageServiceConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  requestTimeoutMs: number;
};

export type UploadEvidenceParams = {
  complaintId: string;
  fileUuid: string;
  extension: string;
  body: PutObjectCommandInput["Body"];
  contentType?: string;
  fileSize: number;
  uploaderId: string;
  virusScanStatus: VirusScanStatus;
  uploadDate?: Date;
};

export class StorageServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = "STORAGE_ERROR") {
    super(message);
    this.name = "StorageServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPLAINT_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const EXTENSION_REGEX = /^[A-Za-z0-9]{1,16}$/;
const STORAGE_KEY_REGEX =
  /^([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9]{1,16})$/i;

const defaultConfig = (): StorageServiceConfig => ({
  bucket: process.env.STORAGE_BUCKET ?? "orcs-evidence-bucket",
  region: process.env.STORAGE_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  endpoint: process.env.STORAGE_ENDPOINT || undefined,
  forcePathStyle:
    (process.env.STORAGE_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true",
  requestTimeoutMs: Number.parseInt(process.env.STORAGE_REQUEST_TIMEOUT_MS ?? "10000", 10),
});

class StorageService {
  private static instance: StorageService | null = null;

  private readonly client: S3Client;
  private readonly config: StorageServiceConfig;

  private constructor(config: StorageServiceConfig) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    const hasStaticCredentials = Boolean(accessKeyId && secretAccessKey);

    this.config = config;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: config.requestTimeoutMs,
        socketTimeout: config.requestTimeoutMs,
      }),
      credentials: hasStaticCredentials
        ? {
            accessKeyId: accessKeyId!,
            secretAccessKey: secretAccessKey!,
            sessionToken,
          }
        : undefined,
    });
  }

  public static getInstance(minioEndpointOverride?: string): StorageService {
    if (!StorageService.instance) {
      const config = defaultConfig();
      if (minioEndpointOverride) {
        config.endpoint = minioEndpointOverride;
        config.forcePathStyle = true;
      }
      StorageService.instance = new StorageService(config);
    }
    return StorageService.instance;
  }

  public getBucket(): string {
    return this.config.bucket;
  }

  public buildObjectKey(complaintId: string, fileUuid: string, extension: string): string {
    const sanitizedComplaintId = complaintId.trim();
    const sanitizedUuid = fileUuid.trim();
    const sanitizedExtension = extension.trim().replace(".", "");

    if (!COMPLAINT_ID_REGEX.test(sanitizedComplaintId)) {
      throw new StorageServiceError(
        "Invalid complaint_id. Allowed: alphanumeric, '-' and '_', max length 128.",
        400,
        "INVALID_COMPLAINT_ID"
      );
    }

    if (!UUID_V4_REGEX.test(sanitizedUuid)) {
      throw new StorageServiceError(
        "Invalid file_uuid. Expected UUID format.",
        400,
        "INVALID_FILE_UUID"
      );
    }

    if (!EXTENSION_REGEX.test(sanitizedExtension)) {
      throw new StorageServiceError(
        "Invalid extension. Use only alphanumeric characters, max length 16.",
        400,
        "INVALID_EXTENSION"
      );
    }

    return `${sanitizedComplaintId}/${sanitizedUuid}.${sanitizedExtension.toLowerCase()}`;
  }

  public async putObject(params: UploadEvidenceParams) {
    const key = this.buildObjectKey(params.complaintId, params.fileUuid, params.extension);
    const uploadDate = (params.uploadDate ?? new Date()).toISOString();

    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: params.body,
          ContentType: params.contentType ?? "application/octet-stream",
          ContentLength: params.fileSize,
          Metadata: {
            file_size: String(params.fileSize),
            upload_date: uploadDate,
            uploader_id: params.uploaderId,
            virus_scan_status: params.virusScanStatus,
          },
        })
      );

      return {
        bucket: this.config.bucket,
        key,
        etag: response.ETag ?? null,
      };
    } catch (error) {
      throw this.mapError(error, "uploading object");
    }
  }

  public async getSignedGetUrl(
    complaintId: string,
    fileUuid: string,
    extension: string,
    expiresInSeconds = Number.parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? "300", 10)
  ) {
    const key = this.buildObjectKey(complaintId, fileUuid, extension);
    return this.getSignedGetUrlForKey(key, expiresInSeconds);
  }

  public async getSignedGetUrlForKey(
    key: string,
    expiresInSeconds = Number.parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? "300", 10)
  ) {
    const parsed = this.parseObjectKey(key);
    if (!parsed) {
      throw new StorageServiceError(
        "Invalid object key. Expected complaintId/fileUuid.ext",
        400,
        "INVALID_OBJECT_KEY"
      );
    }

    try {
      const signedUrl = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: parsed.key,
        }),
        { expiresIn: expiresInSeconds }
      );

      return {
        bucket: this.config.bucket,
        key: parsed.key,
        expiresInSeconds,
        signedUrl,
      };
    } catch (error) {
      throw this.mapError(error, "generating signed URL");
    }
  }

  public async getObjectMetadata(complaintId: string, fileUuid: string, extension: string) {
    const key = this.buildObjectKey(complaintId, fileUuid, extension);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        })
      );

      return {
        bucket: this.config.bucket,
        key,
        contentType: response.ContentType ?? null,
        contentLength: response.ContentLength ?? null,
        metadata: response.Metadata ?? {},
        lastModified: response.LastModified?.toISOString() ?? null,
      };
    } catch (error) {
      throw this.mapError(error, "reading object metadata");
    }
  }

  public parseObjectKey(key: string):
    | { complaintId: string; fileUuid: string; extension: string; key: string }
    | null {
    const trimmedKey = key.trim();
    const match = trimmedKey.match(STORAGE_KEY_REGEX);
    if (!match) return null;
    return {
      complaintId: match[1],
      fileUuid: match[2],
      extension: match[3].toLowerCase(),
      key: trimmedKey,
    };
  }

  public async deleteObject(complaintId: string, fileUuid: string, extension: string) {
    const key = this.buildObjectKey(complaintId, fileUuid, extension);

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        })
      );

      return {
        bucket: this.config.bucket,
        key,
        deleted: true,
      };
    } catch (error) {
      throw this.mapError(error, "deleting object");
    }
  }

  private mapError(error: unknown, action: string): StorageServiceError {
    if (error instanceof StorageServiceError) return error;

    const err = error as {
      name?: string;
      message?: string;
      $metadata?: { httpStatusCode?: number };
      Code?: string;
    };

    const name = err.name ?? "";
    const message = err.message ?? "Unknown storage error";
    const httpStatusCode = err.$metadata?.httpStatusCode;
    const code = err.Code ?? name;
    const lowerMessage = message.toLowerCase();

    if (
      name === "CredentialsProviderError" ||
      code === "InvalidAccessKeyId" ||
      code === "SignatureDoesNotMatch" ||
      code === "InvalidToken" ||
      code === "AccessDenied"
    ) {
      return new StorageServiceError(
        `Invalid or missing credentials while ${action}.`,
        401,
        "INVALID_CREDENTIALS"
      );
    }

    if (
      name === "TimeoutError" ||
      code === "RequestTimeout" ||
      httpStatusCode === 408 ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("timeout")
    ) {
      return new StorageServiceError(
        `Connection timeout while ${action}.`,
        504,
        "STORAGE_TIMEOUT"
      );
    }

    if (httpStatusCode === 404 || code === "NotFound" || code === "NoSuchKey") {
      return new StorageServiceError("File not found.", 404, "FILE_NOT_FOUND");
    }

    return new StorageServiceError(`Storage error while ${action}: ${message}`);
  }
}

export const storageService = StorageService.getInstance();
export { StorageService };
