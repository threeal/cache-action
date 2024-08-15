import 'node:fs';
import os from 'node:os';
import 'node:path';
import https from 'node:https';

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
        req.end();
    });
}

try {
    logInfo("Getting caches information...");
    const [status, caches] = await sendCacheApiRequest("caches", {
        method: "GET",
    });
    if (status !== 200) {
        throw new Error(`Failed to get caches information: ${status}`);
    }
    logInfo(`Found ${caches.totalCount} caches:`);
    for (const cache of caches.artifactCaches) {
        logInfo(`- ${cache.id} ${cache.cacheKey}`);
    }
}
catch (err) {
    logError(err);
    process.exit(1);
}
