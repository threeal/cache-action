import fs from "node:fs";

import {
  commitCache,
  getCache,
  reserveCache,
  uploadCache,
} from "./api/cache.js";

import { downloadFile } from "./api/download.js";

/**
 * Restores a file from the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePath - The path of the file to be restored.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was restored successfully.
 */
export async function restoreCache(
  key: string,
  version: string,
  filePath: string,
): Promise<boolean> {
  const cache = await getCache(key, version);
  if (cache === null) return false;
  await downloadFile(cache.archiveLocation, filePath);
  return true;
}

/**
 * Saves a file to the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePath - The path of the file to be saved.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was saved successfully.
 */
export async function saveCache(
  key: string,
  version: string,
  filePath: string,
): Promise<boolean> {
  const fileSize = fs.statSync(filePath).size;
  const cacheId = await reserveCache(key, version, fileSize);
  if (cacheId === null) return false;
  const file = fs.createReadStream(filePath, {
    fd: fs.openSync(filePath, "r"),
    autoClose: false,
    start: 0,
    end: fileSize,
  });
  await uploadCache(cacheId, file, fileSize);
  await commitCache(cacheId, fileSize);
  return true;
}
