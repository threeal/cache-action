import stream from "node:stream";

import {
  createRequest,
  handleErrorResponse,
  handleJsonResponse,
  handleResponse,
  sendJsonRequest,
  sendStreamRequest,
} from "./api.js";

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
  handleResponse(res);
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
  handleResponse(res);
}
