import { ChildProcess, spawn } from "node:child_process";

/**
 * Handles a child process asynchronously.
 *
 * @param proc - The child process to handle.
 * @returns A promise that resolves when the child process exits successfully,
 * or rejects if the process fails.
 */
export async function handleProcess(proc: ChildProcess): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    proc.stderr?.on("data", (chunk) => chunks.push(chunk));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(
          new Error(
            [
              `Process failed: ${proc.spawnargs.join(" ")}`,
              Buffer.concat(chunks).toString(),
            ].join("\n"),
          ),
        );
      }
    });
  });
}

/**
 * Compresses files into an archive using Tar and Zstandard.
 *
 * @param archivePath - The output path for the compressed archive.
 * @param filePaths - The paths of the files to be compressed.
 * @returns A promise that resolves when the files have been successfully
 * compressed and the archive is created.
 */
export async function compressFiles(
  archivePath: string,
  filePaths: readonly string[],
): Promise<void> {
  const tar = spawn("tar", ["-cf", "-", "-P", ...filePaths]);
  const zstd = spawn("zstd", ["-T0", "-o", archivePath]);

  tar.stdout.pipe(zstd.stdin);

  await Promise.all([handleProcess(tar), handleProcess(zstd)]);
}

/**
 * Extracts files from an archive using Tar and Zstandard.
 *
 * @param archivePath - The path to the compressed archive to be extracted.
 * @returns A promise that resolves when the files have been successfully extracted.
 */
export async function extractFiles(archivePath: string): Promise<void> {
  const zstd = spawn("zstd", ["-d", "-T0", "-c", archivePath]);
  const tar = spawn("tar", ["-xf", "-", "-P"]);

  zstd.stdout.pipe(tar.stdin);

  await Promise.all([handleProcess(zstd), handleProcess(tar)]);
}
