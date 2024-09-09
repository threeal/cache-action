import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  const archivePath = path.join(tempDir, "cache.tar.zst");

  await downloadFile(cache.archiveLocation, archivePath);
  await extractFiles(archivePath);

  await fsPromises.rm(tempDir, { recursive: true });
  return true;
}

/**
 * Saves files to the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePaths - The paths of the files to be saved.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was saved successfully.
 */
export async function saveCache(
  key: string,
  version: string,
  filePaths: readonly string[],
): Promise<boolean> {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  const archivePath = path.join(tempDir, "cache.tar.zst");

  await compressFiles(archivePath, filePaths);
  const archiveStat = await fsPromises.stat(archivePath);

  const cacheId = await reserveCache(key, version, archiveStat.size);
  if (cacheId === null) {
    await fsPromises.rm(tempDir, { recursive: true });
    return false;
  }

  await uploadCache(cacheId, archivePath, archiveStat.size);
  await commitCache(cacheId, archiveStat.size);

  await fsPromises.rm(tempDir, { recursive: true });
  return true;
}
