import fs from "node:fs";
import fsPromises from "node:fs/promises";

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
  const fileStat = await fsPromises.stat("cache.tar");
  const cacheId = await reserveCache(key, version, fileStat.size);
  if (cacheId === null) return false;
  const file = fs.createReadStream("cache.tar", {
    start: 0,
    end: fileStat.size,
  });
  await uploadCache(cacheId, file, fileStat.size);
  await commitCache(cacheId, fileStat.size);
  return true;
}
