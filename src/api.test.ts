import { jest } from "@jest/globals";
import http from "node:http";

jest.unstable_mockModule("node:https", () => ({ default: http }));

type ServerHandlers = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => boolean;
const createServer = (handlers: ServerHandlers[]): http.Server => {
  process.env["ACTIONS_CACHE_URL"] = "http://localhost:12345/";
  process.env["ACTIONS_RUNTIME_TOKEN"] = "some token";

  const server = http.createServer((req, res) => {
    for (const handler of handlers) {
      if (handler(req, res)) return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(12345);
  return server;
};

describe("create HTTPS requests for the GitHub cache API endpoint", () => {
  it("should create an HTTPS request", async () => {
    const { createRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://localhost:12345/";
    process.env["ACTIONS_RUNTIME_TOKEN"] = "some token";

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

    const server = createServer([
      (req, res) => {
        if (req.method !== "POST") return false;
        if (req.url !== "/_apis/artifactcache/caches") return false;
        let rawData = "";
        req.on("data", (chunk) => (rawData += chunk.toString()));
        req.on("end", () => {
          const data = JSON.parse(rawData);
          if (data.message == "some message") {
            res.writeHead(200);
            res.end();
            return;
          } else {
            res.writeHead(400);
            res.end();
          }
        });
        return true;
      },
    ]);

    const req = createRequest("caches", { method: "POST" });

    const res = await sendJsonRequest(req, { message: "some message" });
    expect(res.statusCode).toEqual(200);

    server.close();
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

    const server = createServer([
      (req, res) => {
        if (req.method !== "GET") return false;
        if (req.url !== "/_apis/artifactcache/caches") return false;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "some message" }));
        return true;
      },
    ]);

    const req = createRequest("caches", { method: "GET" });

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      req.on("response", (res) => resolve(res));
      req.on("error", (err) => reject(err));
      req.end();
    });
    expect(res.statusCode).toEqual(200);

    const data = await handleJsonResponse(res);
    expect(data).toEqual({ message: "some message" });

    server.close();
  });
});
