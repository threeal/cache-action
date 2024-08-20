import {
  createRequest,
  handleErrorResponse,
  handleJsonResponse,
  handleResponse,
  sendJsonRequest,
  sendRequest,
  sendStreamRequest,
} from "./https.js";

import type stream from "node:stream";

interface Cache {
  scope: string;
  cacheKey: string;
  cacheVersion: string;
  creationTime: string;
  archiveLocation: string;
}

/**
 * Retrieves cache information for the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves with the cache information or null if not found.
 */
export async function getCache(
  key: string,
  version: string,
): Promise<Cache | null> {
  const req = createRequest(`cache?keys=${key}&version=${version}`, {
    method: "GET",
  });
  const res = await sendRequest(req);

  switch (res.statusCode) {
    case 200:
      return await handleJsonResponse<Cache>(res);

    // Cache not found, return null.
    case 204:
      await handleResponse(res);
      return null;

    default:
      throw await handleErrorResponse(res);
  }
}

/**
 * Reserves a cache with the specified key, version, and size.
 *
 * @param key - The key of the cache to reserve.
 * @param version - The version of the cache to reserve.
 * @param size - The size of the cache to reserve, in bytes.
 * @returns A promise that resolves with the reserved cache ID.
 */
export async function reserveCache(
  key: string,
  version: string,
  size: number,
): Promise<number> {
  const req = createRequest("caches", { method: "POST" });
  const res = await sendJsonRequest(req, { key, version, cacheSize: size });
  if (res.statusCode !== 201) {
    throw await handleErrorResponse(res);
  }
  const { cacheId } = await handleJsonResponse<{ cacheId: number }>(res);
  return cacheId;
}

/**
 * Uploads a file to a cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param file - The readable stream of the file to upload.
 * @param fileSize - The size of the file to upload, in bytes.
 * @returns A promise that resolves with nothing.
 */
export async function uploadCache(
  id: number,
  file: stream.Readable,
  fileSize: number,
): Promise<void> {
  const req = createRequest(`caches/${id}`, { method: "PATCH" });
  const res = await sendStreamRequest(req, file, 0, fileSize);
  if (res.statusCode !== 204) {
    throw await handleErrorResponse(res);
  }
  await handleResponse(res);
}

/**
 * Commits a cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param size - The size of the cache in bytes.
 * @returns A promise that resolves with nothing.
 */
export async function commitCache(id: number, size: number): Promise<void> {
  const req = createRequest(`caches/${id}`, { method: "POST" });
  const res = await sendJsonRequest(req, { size });
  if (res.statusCode !== 204) {
    throw await handleErrorResponse(res);
  }
  await handleResponse(res);
}
