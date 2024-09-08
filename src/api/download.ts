import fsPromises from "node:fs/promises";
import https from "node:https";

import {
  assertIncomingMessageContentType,
  readErrorIncomingMessage,
  readIncomingMessage,
  sendRequest,
} from "./http.js";

/**
 * Retrieves the file size of a file to be downloaded from the specified URL.
 *
 * @param url - The URL of the file to be downloaded.
 * @returns A promise that resolves to the size of the file to be downloaded, in bytes.
 */
export async function getDownloadFileSize(url: string): Promise<number> {
  const req = https.request(url, { method: "HEAD" });
  const res = await sendRequest(req);

  switch (res.statusCode) {
    case 200: {
      await readIncomingMessage(res);
      return Number.parseInt(res.headers["content-length"] as string);
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
 * @param options - The download options.
 * @param options.maxChunkSize - The maximum size of each chunk to be downloaded
 * in bytes. Defaults to 4 MB.
 * @returns A promise that resolves when the download is complete.
 */
export async function downloadFile(
  url: string,
  savePath: string,
  options?: { maxChunkSize?: number },
): Promise<void> {
  const { maxChunkSize } = {
    maxChunkSize: 4 * 1024 * 1024,
    ...options,
  };

  const [file, fileSize] = await Promise.all([
    fsPromises.open(savePath, "w"),
    getDownloadFileSize(url),
  ]);

  const proms: Promise<void>[] = [];
  for (let start = 0; start < fileSize; start += maxChunkSize) {
    proms.push(
      (async () => {
        const end = Math.min(start + maxChunkSize - 1, fileSize);
        const req = https.request(url, { method: "GET" });
        req.setHeader("range", `bytes=${start}-${end}`);

        const res = await sendRequest(req);
        if (res.statusCode === 206) {
          assertIncomingMessageContentType(res, "application/octet-stream");
          const buffer = await readIncomingMessage(res);
          await file.write(buffer, 0, buffer.length, start);
        } else {
          throw await readErrorIncomingMessage(res);
        }
      })(),
    );
  }

  await Promise.all(proms);
  await file.close();
}
