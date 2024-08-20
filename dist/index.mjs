import fs from 'node:fs';
import os from 'node:os';
import 'node:path';
import https from 'node:https';
import stream from 'node:stream/promises';

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
    return new Error(message);
}

/**
 * Retrieves cache information for the specified key and version.
 *
 * @param key - The cache key.
 * @param version - The cache version.
 * @returns A promise that resolves with the cache information or null if not found.
 */
async function getCache(key, version) {
    const req = createRequest(`cache?keys=${key}&version=${version}`, {
        method: "GET",
    });
    const res = await sendRequest(req);
    switch (res.statusCode) {
        case 200:
            return await handleJsonResponse(res);
        // Cache not found, return null.
        case 204:
            await handleResponse(res);
            return null;
        default:
            throw await handleErrorResponse(res);
    }
}
/**
 * Reserves a cache with the specified key, version, and size.
 *
 * @param key - The key of the cache to reserve.
 * @param version - The version of the cache to reserve.
 * @param size - The size of the cache to reserve, in bytes.
 * @returns A promise that resolves with the reserved cache ID.
 */
async function reserveCache(key, version, size) {
    const req = createRequest("caches", { method: "POST" });
    const res = await sendJsonRequest(req, { key, version, cacheSize: size });
    if (res.statusCode !== 201) {
        throw await handleErrorResponse(res);
    }
    const { cacheId } = await handleJsonResponse(res);
    return cacheId;
}
/**
 * Uploads a file to a cache with the specified ID.
 *
 * @param id - The cache ID.
 * @param file - The readable stream of the file to upload.
 * @param fileSize - The size of the file to upload, in bytes.
 * @returns A promise that resolves with nothing.
 */
async function uploadCache(id, file, fileSize) {
    const req = createRequest(`caches/${id}`, { method: "PATCH" });
    const res = await sendStreamRequest(req, file, 0, fileSize);
    if (res.statusCode !== 204) {
        throw await handleErrorResponse(res);
    }
    await handleResponse(res);
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
 * Downloads a file from the specified URL and saves it to the provided path.
 *
 * @param url - The URL of the file to download.
 * @param savePath - The path where the downloaded file will be saved.
 * @returns A promise that resolves when the download is complete.
 */
async function downloadFile(url, savePath) {
    const req = https.request(url);
    const res = await sendRequest(req);
    const file = fs.createWriteStream(savePath);
    await stream.pipeline(res, file);
}

try {
    const key = getInput("key");
    const version = getInput("version");
    const filePath = getInput("file");
    logInfo("Getting cache...");
    const cache = await getCache(key, version);
    if (cache !== null) {
        logInfo("Cache exists, restoring...");
        await downloadFile(cache.archiveLocation, filePath);
        logInfo("Cache restored");
        process.exit(0);
    }
    logInfo("Cache does not exist, saving...");
    const fileSize = fs.statSync(filePath).size;
    logInfo("Reserving cache...");
    const cacheId = await reserveCache(key, version, fileSize);
    logInfo(`Cache reserved with id: ${cacheId}`);
    logInfo("Uploading cache...");
    const file = fs.createReadStream(filePath, {
        fd: fs.openSync(filePath, "r"),
        autoClose: false,
        start: 0,
        end: fileSize,
    });
    await uploadCache(cacheId, file, fileSize);
    logInfo("Cache uploaded");
    logInfo("Commiting cache...");
    await commitCache(cacheId, fileSize);
    logInfo("Cache committed");
}
catch (err) {
    logError(err);
    process.exit(1);
}
