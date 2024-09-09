import { jest } from "@jest/globals";
import fsPromises from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readIncomingMessage } from "./http.js";

jest.unstable_mockModule("node:https", () => ({ default: http }));

type ServerHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => Promise<boolean>;

let serverHandler: ServerHandler = async () => false;

const server = http.createServer(async (req, res) => {
  if (req.headers["authorization"] != "Bearer a-token") {
    res.writeHead(401);
    res.end("unauthorized");
    return;
  }

  if (req.headers["accept"] != "application/json;api-version=6.0-preview") {
    res.writeHead(415);
    res.end("unsupported media type");
    return;
  }

  if (await serverHandler(req, res)) return;

  res.writeHead(400);
  res.end("bad request");
});

beforeAll(() => {
  server.listen(10003);
  process.env["ACTIONS_CACHE_URL"] = "http://localhost:10003/";
  process.env["ACTIONS_RUNTIME_TOKEN"] = "a-token";
});

describe("retrieve caches", () => {
  it("should retrieve a cache", async () => {
    const { getCache } = await import("./api.js");

    serverHandler = async (req, res) => {
      if (req.method !== "GET") return false;
      if (
        req.url !== "/_apis/artifactcache/cache?keys=a-key&version=a-version"
      ) {
        return false;
      }

      res.writeHead(200, undefined, { "content-type": "application/json" });
      res.end(JSON.stringify({ cacheKey: "a-key", cacheVersion: "a-version" }));

      return true;
    };

    const cache = await getCache("a-key", "a-version");
    expect(cache).toEqual({ cacheKey: "a-key", cacheVersion: "a-version" });
  });

  it("should not retrieve a non-existing cache", async () => {
    const { getCache } = await import("./api.js");

    serverHandler = async (req, res) => {
      if (req.method !== "GET") return false;
      if (
        req.url !== "/_apis/artifactcache/cache?keys=a-key&version=a-version"
      ) {
        return false;
      }

      res.writeHead(204);
      res.end();

      return true;
    };

    const cache = await getCache("a-key", "a-version");
    expect(cache).toBeNull();
  });

  it("should fail to retrieve a cache", async () => {
    const { getCache } = await import("./api.js");

    serverHandler = async () => false;

    const prom = getCache("a-key", "a-version");
    await expect(prom).rejects.toThrow("bad request (400)");
  });
});

describe("reserve caches", () => {
  it("should reserve a cache", async () => {
    const { reserveCache } = await import("./api.js");

    serverHandler = async (req, res) => {
      if (req.method !== "POST") return false;
      if (req.url !== "/_apis/artifactcache/caches") return false;

      const buffer = await readIncomingMessage(req);
      const { key, version, cacheSize } = JSON.parse(buffer.toString());
      if (key !== "a-key" || version !== "a-version" || cacheSize !== 1024) {
        return false;
      }

      res.writeHead(201, undefined, { "content-type": "application/json" });
      res.end(JSON.stringify({ cacheId: 9 }));

      return true;
    };

    const cacheId = await reserveCache("a-key", "a-version", 1024);
    expect(cacheId).toBe(9);
  });

  it("should not reserve a reserved cache", async () => {
    const { reserveCache } = await import("./api.js");

    serverHandler = async (req, res) => {
      if (req.method !== "POST") return false;
      if (req.url !== "/_apis/artifactcache/caches") return false;

      const buffer = await readIncomingMessage(req);
      const { key, version, cacheSize } = JSON.parse(buffer.toString());
      if (key !== "a-key" || version !== "a-version" || cacheSize !== 1024) {
        return false;
      }

      res.writeHead(409);
      res.end();

      return true;
    };

    const cacheId = await reserveCache("a-key", "a-version", 1024);
    expect(cacheId).toBeNull();
  });

  it("should fail to reserve a cache", async () => {
    const { reserveCache } = await import("./api.js");

    serverHandler = async () => false;

    const prom = reserveCache("a-key", "a-version", 1024);
    await expect(prom).rejects.toThrow("bad request (400)");
  });
});

describe("upload files to caches", () => {
  let tempPath = "";
  let filePath = "";
  let fileSize = 0;

  beforeAll(async () => {
    tempPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
    filePath = path.join(tempPath, "a-file");

    await fsPromises.writeFile(
      filePath,
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    );
    fileSize = (await fsPromises.stat(filePath)).size;
  });

  it("should upload a file to a cache", async () => {
    const { uploadCache } = await import("./api.js");

    const cacheBuffer = Buffer.alloc(fileSize);
    serverHandler = async (req, res) => {
      if (req.method !== "PATCH") return false;
      if (req.url !== "/_apis/artifactcache/caches/9") return false;
      if (req.headers["content-type"] !== "application/octet-stream")
        return false;

      const range = req.headers["content-range"]?.match(/bytes (.*)-(.*)\/\*/s);
      const start = range != null ? parseInt(range[1]) : 0;

      const buffer = await readIncomingMessage(req);
      cacheBuffer.write(buffer.toString(), start);

      res.writeHead(204);
      res.end(0);

      return true;
    };

    await uploadCache(9, filePath, fileSize, { maxChunkSize: 8 });

    const fileBuffer = await fsPromises.readFile(filePath);
    expect(cacheBuffer.toString()).toBe(fileBuffer.toString());
  });

  it("should fail to upload a file to a cache", async () => {
    const { uploadCache } = await import("./api.js");

    serverHandler = async () => false;

    const prom = uploadCache(9, filePath, fileSize);
    await expect(prom).rejects.toThrow("bad request (400)");
  });

  afterAll(() => fsPromises.rm(tempPath, { recursive: true }));
});

describe("commit caches", () => {
  it("should commit a cache", async () => {
    const { commitCache } = await import("./api.js");

    serverHandler = async (req, res) => {
      if (req.method !== "POST") return false;
      if (req.url !== "/_apis/artifactcache/caches/9") return false;

      const buffer = await readIncomingMessage(req);
      const { size } = JSON.parse(buffer.toString());
      if (size !== 1024) return false;

      res.writeHead(204);
      res.end();

      return true;
    };

    await commitCache(9, 1024);
  });

  it("should fail to commit a cache", async () => {
    const { commitCache } = await import("./api.js");

    serverHandler = async () => false;

    const prom = commitCache(9, 1024);
    await expect(prom).rejects.toThrow("bad request (400)");
  });
});

afterAll(() => server.close());
