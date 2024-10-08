import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  requestCommitCache,
  requestGetCache,
  requestReserveCache,
  requestUploadCache,
} from "./utils/api.js";

import { createArchive, extractArchive } from "./utils/archive.js";
import { downloadFile } from "./utils/download.js";

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
  const cache = await requestGetCache(key, version);
  if (cache === null) return false;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  const archivePath = path.join(tempDir, "cache.tar.zst");

  await downloadFile(cache.archiveLocation, archivePath);
  await extractArchive(archivePath);

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

  await createArchive(archivePath, filePaths);
  const archiveStat = await fsPromises.stat(archivePath);

  const cacheId = await requestReserveCache(key, version, archiveStat.size);
  if (cacheId === null) {
    await fsPromises.rm(tempDir, { recursive: true });
    return false;
  }

  await requestUploadCache(cacheId, archivePath, archiveStat.size);
  await requestCommitCache(cacheId, archiveStat.size);

  await fsPromises.rm(tempDir, { recursive: true });
  return true;
}
