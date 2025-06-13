import { createHash } from "node:crypto";

async function fetchCacheService(method: string, body: unknown) {
  return fetch(
    `${process.env["ACTIONS_RESULTS_URL"]}twirp/github.actions.results.api.v1.CacheService/${method}`,
    {
      body: JSON.stringify(body),
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function handleCacheServiceError(res: Response) {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json();
    if (typeof data === "object" && data && "msg" in data) {
      return new Error(`${data["msg"]} (${res.status})`);
    }
  }
  throw new Error(`${res.statusText} (${res.status})`);
}

function hashVersion(version: string) {
  return createHash("sha256").update(version).digest("hex");
}

interface GetCacheEntryDownloadUrlResponseSchema {
  ok: boolean;
  signed_download_url: string;
}

export async function getCacheEntryDownloadUrl(
  key: string,
  version: string,
): Promise<GetCacheEntryDownloadUrlResponseSchema> {
  const res = await fetchCacheService("GetCacheEntryDownloadURL", {
    key,
    version: hashVersion(version),
  });
  if (!res.ok) {
    await handleCacheServiceError(res);
  }
  return (await res.json()) as GetCacheEntryDownloadUrlResponseSchema;
}

export interface CreateCacheEntryResponse {
  ok: boolean;
  signed_upload_url: string;
}

export async function createCacheEntry(
  key: string,
  version: string,
): Promise<CreateCacheEntryResponse> {
  const res = await fetchCacheService("CreateCacheEntry", {
    key,
    version: hashVersion(version),
  });
  if (!res.ok) {
    if (res.status == 409) return { ok: false, signed_upload_url: "" };
    await handleCacheServiceError(res);
  }
  return (await res.json()) as CreateCacheEntryResponse;
}

export interface FinalizeCacheEntryUploadResponse {
  ok: boolean;
  signed_upload_url: string;
}

export async function finalizeCacheEntryUpload(
  key: string,
  version: string,
  sizeBytes: number,
): Promise<FinalizeCacheEntryUploadResponse> {
  const res = await fetchCacheService("FinalizeCacheEntryUpload", {
    key,
    version: hashVersion(version),
    sizeBytes,
  });
  if (!res.ok) {
    await handleCacheServiceError(res);
  }
  return (await res.json()) as FinalizeCacheEntryUploadResponse;
}
