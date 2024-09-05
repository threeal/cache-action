import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import https from 'node:https';
import 'node:stream/promises';
import { spawn } from 'node:child_process';

/**
 * Retrieves the value of a GitHub Actions input.
 *
 * @param name - The name of the GitHub Actions input.
 * @returns The value of the GitHub Actions input, or an empty string if not found.
 */
function getInput(name) {
    const value = process.env[`INPUT_${name.toUpperCase()}`] || "";
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

/**
 * Creates an HTTPS request for the GitHub cache API endpoint.
 *
 * @param resourcePath - The path of the resource to be accessed in the API.
 * @param options - The options for the HTTPS request (e.g., method, headers).
 * @returns An HTTPS request object.
 */
function createRequest(resourcePath, options) {
    const req = https.request(`${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`, options);
    req.setHeader("Accept", "application/json;api-version=6.0-preview");
    req.setHeader("Authorization", `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`);
    return req;
}
/**
 * Sends an HTTPS request containing raw data.
 *
 * @param req - The HTTPS request object.
 * @param data - The raw data to be sent in the request body.
 * @returns A promise that resolves to an HTTPS response object.
 */
async function sendRequest(req, data) {
    return new Promise((resolve, reject) => {
        req.on("response", (res) => resolve(res));
        req.on("error", (err) => reject(err));
        if (data !== undefined)
            req.write(data);
        req.end();
    });
}
/**
 * Sends an HTTPS request containing JSON data.
 *
 * @param req - The HTTPS request object.
 * @param data - The JSON data to be sent in the request body.
 * @returns A promise that resolves to an HTTPS response object.
 */
async function sendJsonRequest(req, data) {
    req.setHeader("Content-Type", "application/json");
    return sendRequest(req, JSON.stringify(data));
}
/**
 * Sends an HTTPS request containing a binary stream.
 *
 * @param req - The HTTPS request object.
 * @param bin - The binary stream to be sent in the request body.
 * @param start - The starting byte of the binary stream.
 * @param end - The ending byte of the binary stream.
 * @returns A promise that resolves to an HTTPS response object.
 */
async function sendStreamRequest(req, bin, start, end) {
    return new Promise((resolve, reject) => {
        req.setHeader("Content-Type", "application/octet-stream");
        req.setHeader("Content-Range", `bytes ${start}-${end}/*`);
        req.on("response", (res) => resolve(res));
        req.on("error", (err) => reject(err));
        bin.pipe(req);
    });
}
/**
 * Asserts whether the content type of the given HTTP response matches the expected type.
 *
 * @param res - The HTTP response.
 * @param expectedType - The expected content type of the HTTP response.
 * @throws {Error} Throws an error if the content type does not match the expected type.
 */
function assertResponseContentType(res, expectedType) {
    const actualType = res.headers["content-type"] ?? "undefined";
    if (!actualType.includes(expectedType)) {
        throw new Error(`expected content type of the response to be '${expectedType}', but instead got '${actualType}'`);
    }
}
/**
 * Handles an HTTPS response containing raw data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the raw data as a string.
 */
async function handleResponse(res) {
    return new Promise((resolve, reject) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk.toString()));
        res.on("end", () => resolve(data));
        res.on("error", (err) => reject(err));
    });
}
/**
 * Handles an HTTPS response containing JSON data.
 *
 * @typeParam T - The expected type of the parsed JSON data.
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the parsed JSON data of type T.
 */
async function handleJsonResponse(res) {
    assertResponseContentType(res, "application/json");
    const data = await handleResponse(res);
    return JSON.parse(data);
}
/**
 * Handles an HTTPS response containing error data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to an error object.
 */
async function handleErrorResponse(res) {
    const { message } = await handleJsonResponse(res);
    return new Error(`${message} (${res.statusCode})`);
}

/**
 * Reserves a cache with the specified key, version, and size.
 *
 * @param key - The key of the cache to reserve.
 * @param version - The version of the cache to reserve.
 * @param size - The size of the cache to reserve, in bytes.
 * @returns A promise that resolves to the reserved cache ID, or null if the
 * cache is already reserved.
 */
async function reserveCache(key, version, size) {
    const req = createRequest("caches", { method: "POST" });
    const res = await sendJsonRequest(req, { key, version, cacheSize: size });
    switch (res.statusCode) {
        case 201: {
            const { cacheId } = await handleJsonResponse(res);
            return cacheId;
        }
        // Cache already reserved, return null.
        case 409:
            await handleResponse(res);
            return null;
        default:
            throw await handleErrorResponse(res);
    }
}
/**
 * Uploads a file to the cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param filePath - The path of the file to upload.
 * @param fileSize - The size of the file to upload, in bytes.
 * @returns A promise that resolves to nothing.
 */
async function uploadCache(id, filePath, fileSize, options) {
    const { maxChunkSize } = {
        maxChunkSize: 4 * 1024 * 1024,
        ...options,
    };
    const proms = [];
    for (let start = 0; start < fileSize; start += maxChunkSize) {
        proms.push((async () => {
            const end = Math.min(start + maxChunkSize - 1, fileSize);
            const bin = fs.createReadStream(filePath, { start, end });
            const req = createRequest(`caches/${id}`, { method: "PATCH" });
            const res = await sendStreamRequest(req, bin, start, end);
            switch (res.statusCode) {
                case 204:
                    await handleResponse(res);
                    break;
                default:
                    throw await handleErrorResponse(res);
            }
        })());
    }
    await Promise.all(proms);
}
/**
 * Commits a cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param size - The size of the cache in bytes.
 * @returns A promise that resolves with nothing.
 */
async function commitCache(id, size) {
    const req = createRequest(`caches/${id}`, { method: "POST" });
    const res = await sendJsonRequest(req, { size });
    if (res.statusCode !== 204) {
        throw await handleErrorResponse(res);
    }
    await handleResponse(res);
}

/**
 * Handles a child process asynchronously.
 *
 * @param proc - The child process to handle.
 * @returns A promise that resolves when the child process exits successfully,
 * or rejects if the process fails.
 */
async function handleProcess(proc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        proc.stderr?.on("data", (chunk) => chunks.push(chunk));
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve(undefined);
            }
            else {
                reject(new Error([
                    `Process failed: ${proc.spawnargs.join(" ")}`,
                    Buffer.concat(chunks).toString(),
                ].join("\n")));
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
async function compressFiles(archivePath, filePaths) {
    const tar = spawn("tar", ["-cf", "-", "-P", ...filePaths]);
    const zstd = spawn("zstd", ["-T0", "-o", archivePath]);
    tar.stdout.pipe(zstd.stdin);
    await Promise.all([handleProcess(tar), handleProcess(zstd)]);
}

/**
 * Saves files to the cache using the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @param filePath - The paths of the files to be saved.
 * @returns A promise that resolves to a boolean value indicating whether the
 * file was saved successfully.
 */
async function saveCache(key, version, filePaths) {
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

try {
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
        logInfo("Cache already exists");
    }
}
catch (err) {
    logError(err);
    process.exit(1);
}
