import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

export class ProcessError extends Error {
  constructor(args: readonly string[], code: number | null, output: string) {
    let message = "Process failed";
    if (code !== null) message += ` (${code.toString()})`;
    message += `: ${args.join(" ")}`;

    const trimmedOutput = output.trim();
    if (trimmedOutput !== "") message += `\n${trimmedOutput}`;

    super(message);

    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export async function waitProcess(
  proc: ChildProcessWithoutNullStreams,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    proc.stderr.on("data", (chunk) => chunks.push(chunk));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        const output = Buffer.concat(chunks).toString();
        reject(new ProcessError(proc.spawnargs, code, output));
      }
    });
  });
}

export async function createArchive(
  archivePath: string,
  filePaths: readonly string[],
): Promise<void> {
  const tar = spawn("tar", ["-cf", "-", "-P", ...filePaths]);
  const zstd = spawn("zstd", ["-T0", "-o", archivePath]);

  tar.stdout.pipe(zstd.stdin);

  await Promise.all([waitProcess(tar), waitProcess(zstd)]);
}

export async function extractArchive(archivePath: string): Promise<void> {
  const zstd = spawn("zstd", ["-d", "-T0", "-c", archivePath]);
  const tar = spawn("tar", ["-xf", "-", "-P"]);

  zstd.stdout.pipe(tar.stdin);

  await Promise.all([waitProcess(zstd), waitProcess(tar)]);
}

export async function azureStorageCopy(
  source: string,
  destination: string,
): Promise<void> {
  const azcopy = spawn("azcopy", [
    "copy",
    "--skip-version-check",
    "--block-size-mb",
    "32",
    source,
    destination,
  ]);
  await waitProcess(azcopy);
}
