import type http from "node:http";
import type stream from "node:stream";

/**
 * Sends an HTTP request containing raw data.
 *
 * @param req - The HTTP request object.
 * @param data - The raw data to be sent in the request body.
 * @returns A promise that resolves to an HTTP response object.
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
 * Sends an HTTP request containing JSON data.
 *
 * @param req - The HTTP request object.
 * @param data - The JSON data to be sent in the request body.
 * @returns A promise that resolves to an HTTP response object.
 */
export async function sendJsonRequest(
  req: http.ClientRequest,
  data: unknown,
): Promise<http.IncomingMessage> {
  req.setHeader("Content-Type", "application/json");
  return sendRequest(req, JSON.stringify(data));
}

/**
 * Sends an HTTP request containing a binary stream.
 *
 * @param req - The HTTP request object.
 * @param bin - The binary stream to be sent in the request body.
 * @param start - The starting byte of the binary stream.
 * @param end - The ending byte of the binary stream.
 * @returns A promise that resolves to an HTTP response object.
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
 * Asserts whether the content type of the given HTTP incoming message matches
 * the expected type.
 *
 * @param msg - The HTTP incoming message.
 * @param expectedType - The expected content type of the message.
 * @throws {Error} Throws an error if the content type does not match the
 * expected type.
 */
export function assertIncomingMessageContentType(
  msg: http.IncomingMessage,
  expectedType: string,
): void {
  const actualType = msg.headers["content-type"] ?? "undefined";
  if (!actualType.includes(expectedType)) {
    throw new Error(
      `expected content type to be '${expectedType}', but instead got '${actualType}'`,
    );
  }
}

/**
 * Waits until an HTTP incoming message has ended.
 *
 * @param msg - The HTTP incoming message.
 * @returns A promise that resolves when the incoming message ends.
 */
export async function waitIncomingMessage(
  msg: http.IncomingMessage,
): Promise<void> {
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
export async function readIncomingMessage(
  msg: http.IncomingMessage,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
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
export async function readJsonIncomingMessage<T>(
  msg: http.IncomingMessage,
): Promise<T> {
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
export async function readErrorIncomingMessage(
  msg: http.IncomingMessage,
): Promise<Error> {
  const buffer = await readIncomingMessage(msg);

  const contentType = msg.headers["content-type"];
  if (contentType !== undefined) {
    if (contentType.includes("application/json")) {
      const data = JSON.parse(buffer.toString());
      if (typeof data === "object" && "message" in data) {
        return new Error(`${data["message"]} (${msg.statusCode})`);
      }
    } else if (contentType.includes("application/xml")) {
      const data = buffer.toString().match(/<Message>(.*?)<\/Message>/s);
      if (data !== null && data.length > 1) {
        return new Error(`${data[1]} (${msg.statusCode})`);
      }
    }
  }

  return new Error(`${buffer.toString()} (${msg.statusCode})`);
}
