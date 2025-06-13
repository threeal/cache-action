import 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

/**
 * @internal
 * Retrieves the value of an environment variable.
 *
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable.
 * @throws Error if the environment variable is not defined.
 */
function mustGetEnvironment(name) {
    const value = process.env[name];
    if (value === undefined) {
        throw new Error(`the ${name} environment variable must be defined`);
    }
    return value;
}
/**
 * Retrieves the value of a GitHub Actions input.
 *
 * @param name - The name of the GitHub Actions input.
 * @returns The value of the GitHub Actions input, or an empty string if not found.
 */
function getInput(name) {
    const value = process.env[`INPUT_${name.toUpperCase()}`] ?? "";
    return value.trim();
}
/**
 * Sets the value of a GitHub Actions output.
 *
 * @param name - The name of the GitHub Actions output.
 * @param value - The value to set for the GitHub Actions output.
 * @returns A promise that resolves when the value is successfully set.
 */
async function setOutput(name, value) {
    const filePath = mustGetEnvironment("GITHUB_OUTPUT");
    await fsPromises.appendFile(filePath, `${name}=${value}${os.EOL}`);
}

/**
 * Logs an information message in GitHub Actions.
 *
 * @param message - The information message to log.
 */
function logInfo(message) {
    process.stdout.write(`${message}${os.EOL}`);
}
/**
 * Logs an error message in GitHub Actions.
 *
 * @param err - The error, which can be of any type.
 */
function logError(err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`::error::${message}${os.EOL}`);
}

async function fetchCacheService(method, body) {
    return fetch(`${process.env["ACTIONS_RESULTS_URL"]}twirp/github.actions.results.api.v1.CacheService/${method}`, {
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`,
            "Content-Type": "application/json",
        },
    });
}
async function handleCacheServiceError(res) {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (typeof data === "object" && data && "msg" in data) {
            return new Error(`${data["msg"]} (${res.status})`);
        }
    }
    throw new Error(`${res.statusText} (${res.status})`);
}
function hashVersion(version) {
    return createHash("sha256").update(version).digest("hex");
}
async function getCacheEntryDownloadUrl(key, version) {
    const res = await fetchCacheService("GetCacheEntryDownloadURL", {
        key,
        version: hashVersion(version),
    });
    if (!res.ok) {
        await handleCacheServiceError(res);
    }
    return (await res.json());
}

class ProcessError extends Error {
    constructor(args, code, output) {
        let message = "Process failed";
        if (code !== null)
            message += ` (${code.toString()})`;
        message += `: ${args.join(" ")}`;
        const trimmedOutput = output.trim();
        if (trimmedOutput !== "")
            message += `\n${trimmedOutput}`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
async function waitProcess(proc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        proc.stderr.on("data", (chunk) => chunks.push(chunk));
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve(undefined);
            }
            else {
                const output = Buffer.concat(chunks).toString();
                reject(new ProcessError(proc.spawnargs, code, output));
            }
        });
    });
}
async function extractArchive(archivePath) {
    const zstd = spawn("zstd", ["-d", "-T0", "-c", archivePath]);
    const tar = spawn("tar", ["-xf", "-", "-P"]);
    zstd.stdout.pipe(tar.stdin);
    await Promise.all([waitProcess(zstd), waitProcess(tar)]);
}
async function azureStorageCopy(source, destination) {
    const azcopy = spawn("azcopy", [
        "copy",
        "--skip-version-check",
        source,
        destination,
    ]);
    await waitProcess(azcopy);
}

/**
 * Restores files from the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was restored successfully.
 */
async function restoreCache(key, version) {
    const res = await getCacheEntryDownloadUrl(key, version);
    if (!res.ok)
        return false;
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
    const archivePath = path.join(tempDir, "cache.tar.zst");
    await azureStorageCopy(res.signed_download_url, archivePath);
    await extractArchive(archivePath);
    await fsPromises.rm(tempDir, { recursive: true });
    return true;
}

try {
  const key = getInput("key");
  const version = getInput("version");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version)) {
    logInfo("Cache successfully restored");
    await setOutput("restored", "true");
  } else {
    logInfo("Cache does not exist");
    await setOutput("restored", "false");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
