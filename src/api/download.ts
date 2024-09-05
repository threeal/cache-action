import fs from "node:fs";
import https from "node:https";
import streamPromises from "node:stream/promises";
import {
  assertResponseContentType,
  handleErrorResponse,
  sendRequest,
} from "./https.js";

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
  const req = https.request(url);
  const res = await sendRequest(req);

  switch (res.statusCode) {
    case 200: {
      assertResponseContentType(res, "application/octet-stream");
      const file = fs.createWriteStream(savePath);
      await streamPromises.pipeline(res, file);
      break;
    }

    default:
      throw await handleErrorResponse(res);
  }
}
