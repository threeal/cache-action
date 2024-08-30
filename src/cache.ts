import fs from "node:fs";

import {
  commitCache,
  getCache,
  reserveCache,
  uploadCache,
} from "./api/cache.js";

import { downloadFile } from "./api/download.js";
import { compressFiles, extractFiles } from "./archive.js";

/**
 * Restores files from the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was restored successfully.
 */
export async function restoreCache(
  key: string,
  version: string,
): Promise<boolean> {
  const cache = await getCache(key, version);
  if (cache === null) return false;
  await downloadFile(cache.archiveLocation, "cache.tar");
  await extractFiles("cache.tar");
  return true;
}

/**
 * Saves files to the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePath - The paths of the files to be saved.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was saved successfully.
 */
export async function saveCache(
  key: string,
  version: string,
  filePaths: string[],
): Promise<boolean> {
  await compressFiles("cache.tar", filePaths);
  const fileSize = fs.statSync("cache.tar").size;
  const cacheId = await reserveCache(key, version, fileSize);
  if (cacheId === null) return false;
  const file = fs.createReadStream("cache.tar", { start: 0, end: fileSize });
  await uploadCache(cacheId, file, fileSize);
  await commitCache(cacheId, fileSize);
  return true;
}
