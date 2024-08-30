import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFilePromise = promisify(execFile);

/**
 * Compresses files into an archive using Tar.
 *
 * @param archivePath - The output path for the archive.
 * @param filePaths - The paths of the files to be compressed.
 * @returns A promise that resolves when the files have been successfully compressed.
 */
export async function compressFiles(
  archivePath: string,
  filePaths: string[],
): Promise<void> {
  await execFilePromise("tar", ["-cf", archivePath, "-P", ...filePaths]);
}

/**
 * Extracts files from an archive using Tar.
 *
 * @param archivePath - The path to the archive.
 * @returns A promise that resolves when the files have been successfully extracted.
 */
export async function extractFiles(archivePath: string): Promise<void> {
  await execFilePromise("tar", ["-xf", archivePath, "-P"]);
}
