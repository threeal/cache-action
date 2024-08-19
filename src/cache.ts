import {
  createRequest,
  handleJsonResponse,
  handleErrorResponse,
  sendJsonRequest,
} from "./api.js";

/**
 * Reserve a cache with the specified key, version, and size.
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
