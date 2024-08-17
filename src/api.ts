import http from "node:http";
import https from "node:https";

/**
 * Sends an HTTPS request containing JSON data to the GitHub cache API endpoint.
 *
 * @param resourcePath - The path of the resource to be accessed in the API.
 * @param options - The options for the HTTPS request (e.g., method, headers).
 * @param data - The JSON data to be sent in the request body.
 * @returns A promise that resolves to an HTTPS response object.
 */
export async function sendJsonRequest(
  resourcePath: string,
  options: https.RequestOptions,
  data: unknown,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`,
      options,
      (res) => resolve(res),
    );

    req.setHeader("Accept", "application/json;api-version=6.0-preview");
    req.setHeader(
      "Authorization",
      `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`,
    );
    req.setHeader("Content-Type", "application/json");

    req.on("error", (err) => reject(err));

    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Handles an HTTPS response containing JSON data from the GitHub cache API endpoint.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the parsed JSON data.
 */
export async function handleJsonResponse(
  res: http.IncomingMessage,
): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk.toString()));
    res.on("end", () => {
      resolve(JSON.parse(data));
    });
  });
}
