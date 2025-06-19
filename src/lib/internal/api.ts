async function fetchCacheService(
  method: string,
  body: unknown,
): Promise<Response> {
  const url = process.env.ACTIONS_RESULTS_URL ?? "/";
  const token = process.env.ACTIONS_RUNTIME_TOKEN ?? "";
  return fetch(
    `${url}twirp/github.actions.results.api.v1.CacheService/${method}`,
    {
      body: JSON.stringify(body),
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function handleCacheServiceError(res: Response) {
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const data = await res.json();
    if (typeof data === "object" && data && "msg" in data) {
      return new Error(`${data.msg as string} (${res.status.toFixed()})`);
    }
  }
  throw new Error(`${res.statusText} (${res.status.toFixed()})`);
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
    version,
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
    version,
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
    version,
    sizeBytes,
  });
  if (!res.ok) {
    await handleCacheServiceError(res);
  }
  return (await res.json()) as FinalizeCacheEntryUploadResponse;
}
