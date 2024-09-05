import fs from "node:fs";
import https from "node:https";
import streamPromises from "node:stream/promises";

import {
  assertResponseContentType,
  handleErrorResponse,
  handleResponse,
  sendRequest,
} from "./https.js";

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
      await handleResponse(res);
      return Number.parseInt(res.headers["content-length"] as string);
    }

    default:
      throw await handleErrorResponse(res);
  }
}

/**
 * Downloads a file from the specified URL and saves it to the provided path.
 *
 * @param url - The URL of the file to be downloaded.
 * @param savePath - The path where the downloaded file will be saved.
 * @returns A promise that resolves when the download is complete.
 */
export async function downloadFile(
  url: string,
  savePath: string,
): Promise<void> {
  const fileSize = await getDownloadFileSize(url);

  const req = https.request(url, { method: "GET" });
  req.setHeader("range", `bytes=0-${fileSize}`);

  const res = await sendRequest(req);

  switch (res.statusCode) {
    case 206: {
      assertResponseContentType(res, "application/octet-stream");
      const file = fs.createWriteStream(savePath);
      await streamPromises.pipeline(res, file);
      break;
    }

    default:
      throw await handleErrorResponse(res);
  }
}
