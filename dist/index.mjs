import 'node:fs';
import os from 'node:os';
import 'node:path';
import https from 'node:https';

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
 * Sends an HTTPS request containing JSON data.
 *
 * @param req - The HTTPS request object.
 * @param data - The JSON data to be sent in the request body.
 * @returns A promise that resolves to an HTTPS response object.
 */
async function sendJsonRequest(req, data) {
    return new Promise((resolve, reject) => {
        req.setHeader("Content-Type", "application/json");
        req.on("response", (res) => resolve(res));
        req.on("error", (err) => reject(err));
        req.write(JSON.stringify(data));
        req.end();
    });
}
/**
 * Handles an HTTPS response containing JSON data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the parsed JSON data.
 */
async function handleJsonResponse(res) {
    return new Promise((resolve) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk.toString()));
        res.on("end", () => {
            resolve(JSON.parse(data));
        });
    });
}
/**
 * Handles an HTTPS response containing error data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to an error object.
 */
async function handleErrorResponse(res) {
    const data = (await handleJsonResponse(res));
    return new Error(data.message);
}

/**
 * Reserve a cache with the specified key, version, and size.
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
    const { cacheId } = (await handleJsonResponse(res));
    return cacheId;
}

try {
    logInfo("Reserving cache...");
    const cacheId = await reserveCache(getInput("key"), getInput("version"), parseInt(getInput("size"), 10));
    logInfo(`Reserved cache with id: ${cacheId}`);
}
catch (err) {
    logError(err);
    process.exit(1);
}
