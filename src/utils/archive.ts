import { ChildProcess, spawn } from "node:child_process";

/**
 * Waits for a child process to exit.
 *
 * @param proc - The child process to wait for.
 * @returns A promise that resolves when the child process exits successfully,
 * or rejects if the process fails.
 */
export async function waitChildProcess(proc: ChildProcess): Promise<void> {
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
 * Creates a compressed archive from files using Tar and Zstandard.
 *
 * @param archivePath - The output path for the compressed archive.
 * @param filePaths - The paths of the files to be archived.
 * @returns A promise that resolves when the compressed archive is created.
 */
export async function createArchive(
  archivePath: string,
  filePaths: readonly string[],
): Promise<void> {
  const tar = spawn("tar", ["-cf", "-", "-P", ...filePaths]);
  const zstd = spawn("zstd", ["-T0", "-o", archivePath]);

  tar.stdout.pipe(zstd.stdin);

  await Promise.all([waitChildProcess(tar), waitChildProcess(zstd)]);
}

/**
 * Extracts files from a compressed archive using Tar and Zstandard.
 *
 * @param archivePath - The path to the compressed archive to be extracted.
 * @returns A promise that resolves when the files have been successfully extracted.
 */
export async function extractArchive(archivePath: string): Promise<void> {
  const zstd = spawn("zstd", ["-d", "-T0", "-c", archivePath]);
  const tar = spawn("tar", ["-xf", "-", "-P"]);

  zstd.stdout.pipe(tar.stdin);

  await Promise.all([waitChildProcess(zstd), waitChildProcess(tar)]);
}
