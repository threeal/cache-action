import fs from "node:fs";
import type http from "node:http";
import https from "node:https";

import {
  readErrorIncomingMessage,
  readJsonIncomingMessage,
  sendJsonRequest,
  sendRequest,
  sendStreamRequest,
  waitIncomingMessage,
} from "./http.js";

interface Cache {
  scope: string;
  cacheKey: string;
  cacheVersion: string;
  creationTime: string;
  archiveLocation: string;
}

function createCacheRequest(
  resourcePath: string,
  options: https.RequestOptions,
): http.ClientRequest {
  const url = `${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`;
  const req = https.request(url, options);

  req.setHeader("Accept", "application/json;api-version=6.0-preview");

  const bearer = `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`;
  req.setHeader("Authorization", bearer);

  return req;
}

/**
 * Sends a request to retrieve cache information for the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves with the cache information or null if not found.
 */
export async function requestGetCache(
  key: string,
  version: string,
): Promise<Cache | null> {
  const resourcePath = `cache?keys=${key}&version=${version}`;
  const req = createCacheRequest(resourcePath, { method: "GET" });

  const res = await sendRequest(req);
  switch (res.statusCode) {
    case 200:
      return await readJsonIncomingMessage<Cache>(res);

    // Cache not found, return null.
    case 204:
      await waitIncomingMessage(res);
      return null;

    default:
      throw await readErrorIncomingMessage(res);
  }
}

/**
 * Sends a request to reserve a cache with the specified key, version, and size.
 *
 * @param key - The key of the cache to reserve.
 * @param version - The version of the cache to reserve.
 * @param size - The size of the cache to reserve, in bytes.
 * @returns A promise that resolves to the reserved cache ID, or null if the
 * cache is already reserved.
 */
export async function requestReserveCache(
  key: string,
  version: string,
  size: number,
): Promise<number | null> {
  const req = createCacheRequest("caches", { method: "POST" });
  const res = await sendJsonRequest(req, { key, version, cacheSize: size });

  switch (res.statusCode) {
    case 201: {
      const { cacheId } = await readJsonIncomingMessage<{ cacheId: number }>(
        res,
      );
      return cacheId;
    }

    // Cache already reserved, return null.
    case 409:
      await waitIncomingMessage(res);
      return null;

    default:
      throw await readErrorIncomingMessage(res);
  }
}

/**
 * Sends multiple requests to upload a file to the cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param filePath - The path of the file to upload.
 * @param fileSize - The size of the file to upload, in bytes.
 * @param options - The upload options.
 * @param options.maxChunkSize - The maximum size of each chunk to be uploaded,
 * in bytes. Defaults to 4 MB.
 * @returns A promise that resolves when the file has been uploaded.
 */
export async function requestUploadCache(
  id: number,
  filePath: string,
  fileSize: number,
  options?: { maxChunkSize?: number },
): Promise<void> {
  const { maxChunkSize } = {
    maxChunkSize: 4 * 1024 * 1024,
    ...options,
  };

  const proms: Promise<void>[] = [];
  for (let start = 0; start < fileSize; start += maxChunkSize) {
    proms.push(
      (async () => {
        const end = Math.min(start + maxChunkSize - 1, fileSize);
        const bin = fs.createReadStream(filePath, { start, end });

        const req = createCacheRequest(`caches/${id}`, { method: "PATCH" });
        const res = await sendStreamRequest(req, bin, start, end);

        switch (res.statusCode) {
          case 204:
            await waitIncomingMessage(res);
            break;

          default:
            throw await readErrorIncomingMessage(res);
        }
      })(),
    );
  }

  await Promise.all(proms);
}

/**
 * Sends a request to commit a cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param size - The size of the cache to be committed, in bytes.
 * @returns A promise that resolves when the cache has been committed.
 */
export async function requestCommitCache(
  id: number,
  size: number,
): Promise<void> {
  const req = createCacheRequest(`caches/${id}`, { method: "POST" });
  const res = await sendJsonRequest(req, { size });
  if (res.statusCode !== 204) {
    throw await readErrorIncomingMessage(res);
  }
  await waitIncomingMessage(res);
}
