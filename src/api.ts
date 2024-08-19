import http from "node:http";
import https from "node:https";
import stream from "node:stream";

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
  return new Promise((resolve, reject) => {
    req.setHeader("Content-Type", "application/json");

    req.on("response", (res) => resolve(res));
    req.on("error", (err) => reject(err));

    req.write(JSON.stringify(data));
    req.end();
  });
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
 * Handles an HTTPS response containing JSON data.
 *
 * @param res - The HTTPS response object.
 * @returns A promise that resolves to the parsed JSON data.
 */
export async function handleJsonResponse(
  res: http.IncomingMessage,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk.toString()));
    res.on("end", () => resolve(JSON.parse(data)));
    res.on("error", (err) => reject(err));
  });
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
  const data = (await handleJsonResponse(res)) as { message: string };
  return new Error(data.message);
}
