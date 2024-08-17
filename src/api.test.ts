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
    const token = req.headers.authorization;
    if (token !== "Bearer some token") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify(`invalid bearer token: ${token}`));
      return;
    }

    for (const handler of handlers) {
      if (handler(req, res)) return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(12345);
  return server;
};

describe("send requests containing JSON data to GitHub cache API endpoints", () => {
  it("should send a request to a valid endpoint", async () => {
    const { sendJsonRequest } = await import("./api.js");

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

    const res = await sendJsonRequest(
      "caches",
      { method: "POST" },
      { message: "some message" },
    );
    expect(res.statusCode).toEqual(200);

    server.close();
  });

  it("should fail to send a request to an invalid endpoint", async () => {
    const { sendJsonRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://invalid/";

    await expect(
      sendJsonRequest("caches", { method: "POST" }, {}),
    ).rejects.toThrow();
  });
});

describe("handle responses containing JSON data from GitHub cache API endpoints", () => {
  it("should handle a response from an endpoint", async () => {
    const { handleJsonResponse, sendJsonRequest } = await import("./api.js");

    const server = createServer([
      (req, res) => {
        if (req.method !== "GET") return false;
        if (req.url !== "/_apis/artifactcache/caches") return false;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "some message" }));
        return true;
      },
    ]);

    const res = await sendJsonRequest("caches", { method: "GET" }, {});
    expect(res.statusCode).toEqual(200);

    const data = await handleJsonResponse(res);
    expect(data).toEqual({ message: "some message" });

    server.close();
  });
});
