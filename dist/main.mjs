import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import https from 'node:https';
import streamPromises from 'node:stream/promises';
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
 * Sets the value of a GitHub Actions output.
 *
 * @param name - The name of the GitHub Actions output.
 * @param value - The value of the GitHub Actions output
 */
function setOutput(name, value) {
    fs.appendFileSync(process.env["GITHUB_OUTPUT"], `${name}=${value}${os.EOL}`);
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
 * Sends an HTTP request containing raw data.
 *
 * @param req - The HTTP request object.
 * @param data - The raw data to be sent in the request body.
 * @returns A promise that resolves to an HTTP response object.
 */
async function sendRequest(req, data) {
    return new Promise((resolve, reject) => {
        req.on("response", (res) => resolve(res));
        req.on("error", reject);
        req.end();
    });
}
/**
 * Asserts whether the content type of the given HTTP incoming message matches
 * the expected type.
 *
 * @param msg - The HTTP incoming message.
 * @param expectedType - The expected content type of the message.
 * @throws {Error} Throws an error if the content type does not match the
 * expected type.
 */
function assertIncomingMessageContentType(msg, expectedType) {
    const actualType = msg.headers["content-type"] ?? "undefined";
    if (!actualType.includes(expectedType)) {
        throw new Error(`expected content type to be '${expectedType}', but instead got '${actualType}'`);
    }
}
/**
 * Waits until an HTTP incoming message has ended.
 *
 * @param msg - The HTTP incoming message.
 * @returns A promise that resolves when the incoming message ends.
 */
async function waitIncomingMessage(msg) {
    return new Promise((resolve, reject) => {
        msg.on("data", () => {
            /** discarded **/
        });
        msg.on("end", resolve);
        msg.on("error", reject);
    });
}
/**
 * Reads the data from an HTTP incoming message.
 *
 * @param msg - The HTTP incoming message.
 * @returns A promise that resolves to the buffered data from the message.
 */
async function readIncomingMessage(msg) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        msg.on("data", (chunk) => chunks.push(chunk));
        msg.on("end", () => resolve(Buffer.concat(chunks)));
        msg.on("error", reject);
    });
}
/**
 * Reads the JSON data from an HTTP incoming message.
 *
 * @typeParam T - The expected type of the parsed JSON data.
 * @param msg - The HTTP incoming message.
 * @returns A promise that resolves to the parsed JSON data from the message.
 */
async function readJsonIncomingMessage(msg) {
    assertIncomingMessageContentType(msg, "application/json");
    const buffer = await readIncomingMessage(msg);
    return JSON.parse(buffer.toString());
}
/**
 * Reads the error data from an HTTP incoming message.
 *
 * @param msg - The HTTP incoming message.
 * @returns A promise that resolves to an `Error` object based on the error
 * data from the message.
 */
async function readErrorIncomingMessage(msg) {
    const buffer = await readIncomingMessage(msg);
    const contentType = msg.headers["content-type"];
    if (contentType !== undefined) {
        if (contentType.includes("application/json")) {
            const data = JSON.parse(buffer.toString());
            if (typeof data === "object" && "message" in data) {
                return new Error(`${data["message"]} (${msg.statusCode})`);
            }
        }
        else if (contentType.includes("application/xml")) {
            const data = buffer.toString().match(/<Message>(.*?)<\/Message>/s);
            if (data !== null && data.length > 1) {
                return new Error(`${data[1]} (${msg.statusCode})`);
            }
        }
    }
    return new Error(`${buffer.toString()} (${msg.statusCode})`);
}

function createCacheRequest(resourcePath, options) {
    const url = `${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`;
    const req = https.request(url, options);
    req.setHeader("Accept", "application/json;api-version=6.0-preview");
    const bearer = `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`;
    req.setHeader("Authorization", bearer);
    return req;
}
/**
 * Retrieves cache information for the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves with the cache information or null if not found.
 */
async function getCache(key, version) {
    const resourcePath = `cache?keys=${key}&version=${version}`;
    const req = createCacheRequest(resourcePath, { method: "GET" });
    const res = await sendRequest(req);
    switch (res.statusCode) {
        case 200:
            return await readJsonIncomingMessage(res);
        // Cache not found, return null.
        case 204:
            await waitIncomingMessage(res);
            return null;
        default:
            throw await readErrorIncomingMessage(res);
    }
}

/**
 * Retrieves the file size of a file to be downloaded from the specified URL.
 *
 * @param url - The URL of the file to be downloaded.
 * @returns A promise that resolves to the size of the file to be downloaded, in bytes.
 */
async function getDownloadFileSize(url) {
    const req = https.request(url, { method: "HEAD" });
    const res = await sendRequest(req);
    switch (res.statusCode) {
        case 200: {
            await readIncomingMessage(res);
            return Number.parseInt(res.headers["content-length"]);
        }
        default:
            throw await readErrorIncomingMessage(res);
    }
}
/**
 * Downloads a file from the specified URL and saves it to the provided path.
 *
 * @param url - The URL of the file to be downloaded.
 * @param savePath - The path where the downloaded file will be saved.
 * @returns A promise that resolves when the download is complete.
 */
async function downloadFile(url, savePath) {
    const fileSize = await getDownloadFileSize(url);
    const maxChunkSize = 4 * 1024 * 1024;
    const proms = [];
    for (let start = 0; start < fileSize; start += maxChunkSize) {
        proms.push((async () => {
            const end = Math.min(start + maxChunkSize - 1, fileSize);
            const req = https.request(url, { method: "GET" });
            req.setHeader("range", `bytes=${start}-${end}`);
            const res = await sendRequest(req);
            if (res.statusCode === 206) {
                assertIncomingMessageContentType(res, "application/octet-stream");
                const file = fs.createWriteStream(savePath, { start });
                await streamPromises.pipeline(res, file);
            }
            else {
                throw await readErrorIncomingMessage(res);
            }
        })());
    }
    await Promise.all(proms);
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
 * Extracts files from an archive using Tar and Zstandard.
 *
 * @param archivePath - The path to the compressed archive to be extracted.
 * @returns A promise that resolves when the files have been successfully extracted.
 */
async function extractFiles(archivePath) {
    const zstd = spawn("zstd", ["-d", "-T0", "-c", archivePath]);
    const tar = spawn("tar", ["-xf", "-", "-P"]);
    zstd.stdout.pipe(tar.stdin);
    await Promise.all([handleProcess(zstd), handleProcess(tar)]);
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
    const cache = await getCache(key, version);
    if (cache === null)
        return false;
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
    const archivePath = path.join(tempDir, "cache.tar.zst");
    await downloadFile(cache.archiveLocation, archivePath);
    await extractFiles(archivePath);
    await fsPromises.rm(tempDir, { recursive: true });
    return true;
}

try {
    const key = getInput("key");
    const version = getInput("version");
    logInfo("Restoring cache...");
    if (await restoreCache(key, version)) {
        logInfo("Cache successfully restored");
        setOutput("restored", "true");
    }
    else {
        logInfo("Cache does not exist");
        setOutput("restored", "false");
    }
}
catch (err) {
    logError(err);
    process.exit(1);
}
