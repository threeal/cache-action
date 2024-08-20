import https from "node:https";

import type http from "node:http";
import type stream from "node:stream";

/**
 * Creates an HTTPS request for the GitHub cache API endpoint.
 *
 * @param resourcePath - The path of the resource to be accessed in the API.
 * @param options - The options for the HTTPS request (e.g., method, headers).
 * @returns An HTTPS request object.
 */
export function createRequest(
  resourcePath: string,
  options: https.RequestOptions,
): http.ClientRequest {
  const req = https.request(
    `${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`,
    options,
  );

  req.setHeader("Accept", "application/json;api-version=6.0-preview");
  req.setHeader(
    "Authorization",
    `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`,
  );

  return req;
}

/**
 * Sends an HTTPS request containing raw data.
 *
 * @param req - The HTTPS request object.
 * @param data - The raw data to be sent in the request body.
 * @returns A promise that resolves to an HTTPS response object.
 */
export async function sendRequest(
  req: http.ClientRequest,
  data?: string,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    req.on("response", (res) => resolve(res));
    req.on("error", (err) => reject(err));

    if (data !== undefined) req.write(data);
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
export async function sendJsonRequest(
  req: http.ClientRequest,
  data: unknown,
): Promise<http.IncomingMessage> {
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
export async function sendStreamRequest(
  req: http.ClientRequest,
  bin: stream.Readable,
  start: number,
  end: number,
): Promise<http.IncomingMessage> {
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
export async function handleResponse(
  res: http.IncomingMessage,
): Promise<string> {
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
export async function handleJsonResponse<T>(
  res: http.IncomingMessage,
): Promise<T> {
  const data = await handleResponse(res);
  return JSON.parse(data);
}

/**
 * Handles an HTTPS response containing error data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to an error object.
 */
export async function handleErrorResponse(
  res: http.IncomingMessage,
): Promise<Error> {
  const { message } = await handleJsonResponse<{ message: string }>(res);
  return new Error(message);
}
