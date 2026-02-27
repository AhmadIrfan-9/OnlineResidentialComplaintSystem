import { storageService } from "@/lib/storage/StorageService";

export type EvidenceRecord = {
  id: string;
  fileUrl: string;
  fileType: string;
};

const isHttpUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

export const resolveEvidenceAccessUrl = async (fileUrl: string): Promise<string> => {
  if (isHttpUrl(fileUrl)) {
    return fileUrl;
  }

  const parsed = storageService.parseObjectKey(fileUrl);
  if (!parsed) {
    return fileUrl;
  }

  try {
    const signed = await storageService.getSignedGetUrlForKey(parsed.key);
    return signed.signedUrl;
  } catch {
    return fileUrl;
  }
};

export const resolveEvidenceListUrls = async (
  evidences: EvidenceRecord[]
): Promise<EvidenceRecord[]> => {
  const resolved = await Promise.all(
    evidences.map(async (evidence) => ({
      ...evidence,
      fileUrl: await resolveEvidenceAccessUrl(evidence.fileUrl),
    }))
  );

  return resolved;
};
