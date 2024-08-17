import { jest } from "@jest/globals";
import http from "node:http";

jest.unstable_mockModule("node:https", () => ({ default: http }));

let server: http.Server;
let serverHandler: (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => boolean;

beforeAll(() => {
  server = http.createServer((req, res) => {
    if (!serverHandler(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(12345);
});

beforeEach(() => {
  process.env["ACTIONS_CACHE_URL"] = "http://localhost:12345/";
  process.env["ACTIONS_RUNTIME_TOKEN"] = "some token";

  serverHandler = () => false;
});

describe("create HTTPS requests for the GitHub cache API endpoint", () => {
  it("should create an HTTPS request", async () => {
    const { createRequest } = await import("./api.js");

    const req = createRequest("caches", { method: "GET" });
    req.end();

    expect(req.path).toBe("/_apis/artifactcache/caches");
    expect(req.method).toBe("GET");

    expect(req.getHeader("Accept")).toBe(
      "application/json;api-version=6.0-preview",
    );

    expect(req.getHeader("Authorization")).toBe("Bearer some token");
  });
});

describe("send requests containing JSON data", () => {
  it("should send a request to a valid endpoint", async () => {
    const { createRequest, sendJsonRequest } = await import("./api.js");

    serverHandler = (req, res) => {
      if (req.method !== "POST") return false;
      if (req.url !== "/_apis/artifactcache/caches") return false;

      let rawData = "";
      req.on("data", (chunk) => (rawData += chunk.toString()));
      req.on("end", () => {
        const data = JSON.parse(rawData);
        res.writeHead(data.message == "some message" ? 200 : 400);
        res.end(" ");
      });
      return true;
    };

    const req = createRequest("caches", { method: "POST" });

    const res = await sendJsonRequest(req, { message: "some message" });
    expect(res.statusCode).toEqual(200);
  });

  it("should fail to send a request to an invalid endpoint", async () => {
    const { createRequest, sendJsonRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://invalid/";

    const req = createRequest("caches", { method: "POST" });
    await expect(sendJsonRequest(req, {})).rejects.toThrow();
  });
});

describe("handle responses containing JSON data", () => {
  it("should handle a response", async () => {
    const { createRequest, handleJsonResponse } = await import("./api.js");

    serverHandler = (req, res) => {
      if (req.method !== "GET") return false;
      if (req.url !== "/_apis/artifactcache/caches") return false;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "some message" }));
      return true;
    };

    const req = createRequest("caches", { method: "GET" });

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      req.on("response", (res) => resolve(res));
      req.on("error", (err) => reject(err));
      req.end();
    });
    expect(res.statusCode).toEqual(200);

    const data = await handleJsonResponse(res);
    expect(data).toEqual({ message: "some message" });
  });
});

describe("handle responses containing error data", () => {
  it("should handle a response", async () => {
    const { createRequest, handleErrorResponse } = await import("./api.js");

    serverHandler = (req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "some error" }));
      return true;
    };

    const req = createRequest("caches", { method: "GET" });

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      req.on("response", (res) => resolve(res));
      req.on("error", (err) => reject(err));
      req.end();
    });

    const err = await handleErrorResponse(res);
    expect(err.message).toBe("some error");
  });
});

afterAll(() => server.close());
