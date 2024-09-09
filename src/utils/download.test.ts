import { jest } from "@jest/globals";
import fsPromises from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

jest.unstable_mockModule("node:https", () => ({ default: http }));

const serverFiles: Record<string, any | undefined> = {
  "/a-file": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "/a-corrupted-file": { length: 32 },
};

const server = http.createServer((req, res) => {
  const file = serverFiles[req.url as string];
  if (file === undefined) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  if (req.method === "HEAD") {
    res.writeHead(200, undefined, { "content-length": file.length.toString() });
    res.end();
  } else if (req.method === "GET") {
    if (typeof file === "string") {
      const range = req.headers["range"]?.match(/bytes=(.*)-(.*)/s);
      const start = range != null ? parseInt(range[1]) : 0;
      const end = range != null ? parseInt(range[2]) : 0;

      res.writeHead(206, undefined, {
        "content-type": "application/octet-stream",
      });
      res.end(file.substring(start, end + 1));
    } else {
      res.writeHead(500);
      res.end("internal server error");
    }
  } else {
    res.writeHead(400);
    res.end("bad request");
  }
});

beforeAll(() => server.listen(10002));

describe("get the size of files to be downloaded", () => {
  it("should return the size of a file", async () => {
    const { getDownloadFileSize } = await import("./download.js");

    const fileSize = await getDownloadFileSize("http://localhost:10002/a-file");
    expect(fileSize).toBe(serverFiles["/a-file"].length);
  });

  it("should throw an error for an invalid file", async () => {
    const { getDownloadFileSize } = await import("./download.js");

    const prom = getDownloadFileSize("http://localhost:10002/an-invalid-file");

    // TODO: It should handle the case when the error message is empty.
    await expect(prom).rejects.toThrow(" (404)");
  });
});

describe("download files", () => {
  let tempPath = "";
  beforeAll(async () => {
    tempPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  });

  it("should download a file", async () => {
    const { downloadFile } = await import("./download.js");

    const savePath = path.join(tempPath, "a-file");
    await downloadFile("http://localhost:10002/a-file", savePath, {
      maxChunkSize: 8,
    });

    const buffer = await fsPromises.readFile(savePath);
    expect(buffer.toString()).toBe(serverFiles["/a-file"]);
  });

  it("should throw an error for a corrupted file", async () => {
    const { downloadFile } = await import("./download.js");

    const savePath = path.join(tempPath, "a-corrupted-file");
    const prom = downloadFile(
      "http://localhost:10002/a-corrupted-file",
      savePath,
    );

    expect(prom).rejects.toThrow("internal server error (500)");
  });

  afterAll(() => fsPromises.rm(tempPath, { recursive: true }));
});

afterAll(() => server.close());
