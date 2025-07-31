import { createHash } from "node:crypto";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createCacheEntry,
  finalizeCacheEntryUpload,
  getCacheEntryDownloadUrl,
} from "./internal/api.js";

import {
  azureStorageCopy,
  createArchive,
  extractArchive,
} from "./internal/cmd.js";

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
  const versionHash = createHash("sha256").update(version).digest("hex");
  const res = await getCacheEntryDownloadUrl(key, versionHash);
  if (!res.ok) return false;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  const archivePath = path.join(tempDir, "cache.tar.zst");

  await azureStorageCopy(res.signed_download_url, archivePath);
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

  const versionHash = createHash("sha256").update(version).digest("hex");
  const res = await createCacheEntry(key, versionHash);
  if (res.ok) {
    await azureStorageCopy(archivePath, res.signed_upload_url);
    const { ok } = await finalizeCacheEntryUpload(
      key,
      versionHash,
      archiveStat.size,
    );
    res.ok = ok;
  }

  await fsPromises.rm(tempDir, { recursive: true });
  return res.ok;
}
