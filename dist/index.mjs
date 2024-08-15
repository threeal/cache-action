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
 * Sends an HTTPS request to the GitHub cache API endpoint.
 *
 * @param resourcePath - The path of the resource to be accessed in the API.
 * @param options - The options for the HTTPS request (e.g., method, headers).
 * @param data - The data to be sent in the request body (optional).
 * @returns A promise that resolves to a tuple containing the response status
 * code and the parsed response data.
 */
async function sendCacheApiRequest(resourcePath, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(`${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`, options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk.toString()));
            res.on("end", () => {
                resolve([res.statusCode, JSON.parse(data)]);
            });
        });
        req.setHeader("Accept", "application/json;api-version=6.0-preview");
        req.setHeader("Authorization", `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`);
        req.setHeader("Content-Type", "application/json");
        req.on("error", (err) => reject(err));
        if (data !== undefined) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
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
    const [status, { cacheId }] = await sendCacheApiRequest("caches", { method: "POST" }, { key, version, cacheSize: size });
    if (status !== 201) {
        throw new Error(`failed to reserve cache: ${status}}`);
    }
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
