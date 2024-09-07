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
    req.on("error", reject);

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
    req.on("error", reject);

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
export function assertResponseContentType(
  res: http.IncomingMessage,
  expectedType: string,
): void {
  const actualType = res.headers["content-type"] ?? "undefined";
  if (!actualType.includes(expectedType)) {
    throw new Error(
      `expected content type of the response to be '${expectedType}', but instead got '${actualType}'`,
    );
  }
}

/**
 * Handles an HTTPS response.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the buffered data of the HTTPS response.
 */
export async function handleResponse(
  res: http.IncomingMessage,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);
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
  assertResponseContentType(res, "application/json");
  const buffer = await handleResponse(res);
  return JSON.parse(buffer.toString());
}

/**
 * Handles an HTTPS response containing error data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to an `Error` object.
 */
export async function handleErrorResponse(
  res: http.IncomingMessage,
): Promise<Error> {
  const buffer = await handleResponse(res);

  const contentType = res.headers["content-type"];
  if (contentType !== undefined) {
    if (contentType.includes("application/json")) {
      const data = JSON.parse(buffer.toString());
      if (typeof data === "object" && "message" in data) {
        return new Error(`${data["message"]} (${res.statusCode})`);
      }
    } else if (contentType.includes("application/xml")) {
      const data = buffer.toString().match(/<Message>(.*?)<\/Message>/s);
      if (data !== null && data.length > 1) {
        return new Error(`${data[1]} (${res.statusCode})`);
      }
    }
  }

  return new Error(`${buffer.toString()} (${res.statusCode})`);
}
