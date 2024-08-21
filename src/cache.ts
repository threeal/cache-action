import { getCache } from "./api/cache.js";
import { downloadFile } from "./api/download.js";

/**
 * Restores a file from the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePath - The path to the file to be restored.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was successfully restored.
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
