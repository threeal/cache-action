import 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

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
 * Retrieves the value of a GitHub Actions state.
 *
 * @param name - The name of the GitHub Actions state.
 * @returns The value of the GitHub Actions state, or an empty string if not found.
 */
function getState(name) {
    const value = process.env[`STATE_${name}`] ?? "";
    return value.trim();
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
    const url = process.env.ACTIONS_RESULTS_URL ?? "/";
    const token = process.env.ACTIONS_RUNTIME_TOKEN ?? "";
    return fetch(`${url}twirp/github.actions.results.api.v1.CacheService/${method}`, {
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
}
async function handleCacheServiceError(res) {
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        const data = await res.json();
        if (typeof data === "object" && data && "msg" in data) {
            throw new Error(`${data.msg} (${res.status.toFixed()})`);
        }
    }
    throw new Error(`${res.statusText} (${res.status.toFixed()})`);
}
function hashVersion(version) {
    return createHash("sha256").update(version).digest("hex");
}
async function createCacheEntry(key, version) {
    const res = await fetchCacheService("CreateCacheEntry", {
        key,
        version: hashVersion(version),
    });
    if (!res.ok) {
        if (res.status == 409)
            return { ok: false, signed_upload_url: "" };
        await handleCacheServiceError(res);
    }
    return (await res.json());
}
async function finalizeCacheEntryUpload(key, version, sizeBytes) {
    const res = await fetchCacheService("FinalizeCacheEntryUpload", {
        key,
        version: hashVersion(version),
        sizeBytes,
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
async function createArchive(archivePath, filePaths) {
    const tar = spawn("tar", ["-cf", "-", "-P", ...filePaths]);
    const zstd = spawn("zstd", ["-T0", "-o", archivePath]);
    tar.stdout.pipe(zstd.stdin);
    await Promise.all([waitProcess(tar), waitProcess(zstd)]);
}
async function azureStorageCopy(source, destination) {
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

/**
 * Saves files to the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePaths - The paths of the files to be saved.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was saved successfully.
 */
async function saveCache(key, version, filePaths) {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
    const archivePath = path.join(tempDir, "cache.tar.zst");
    await createArchive(archivePath, filePaths);
    const archiveStat = await fsPromises.stat(archivePath);
    const res = await createCacheEntry(key, version);
    if (res.ok) {
        await azureStorageCopy(archivePath, res.signed_upload_url);
        const { ok } = await finalizeCacheEntryUpload(key, version, archiveStat.size);
        res.ok = ok;
    }
    await fsPromises.rm(tempDir, { recursive: true });
    return res.ok;
}

try {
    if (getState("restored") === "true") {
        logInfo("Cache already restored, skipping cache save");
    }
    else {
        const key = getInput("key");
        const version = getInput("version");
        const filePaths = getInput("files")
            .split(/\s+/)
            .filter((arg) => arg != "");
        logInfo("Saving cache...");
        if (await saveCache(key, version, filePaths)) {
            logInfo("Cache successfully saved");
        }
        else {
            logInfo("Aborting cache save, cache already exists");
        }
    }
}
catch (err) {
    logError(err);
    process.exit(1);
}
