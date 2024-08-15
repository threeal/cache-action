import { jest } from "@jest/globals";
import http from "node:http";

jest.unstable_mockModule("node:https", () => ({ default: http }));

describe("send HTTPS requests to GitHub cache API endpoints", () => {
  it("should send a request to a valid endpoint", async () => {
    const { sendCacheApiRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://localhost:12345/";
    process.env["ACTIONS_RUNTIME_TOKEN"] = "some token";

    const server = http.createServer((req, res) => {
      let rawData = "";
      req.on("data", (chunk) => (rawData += chunk.toString()));
      req.on("end", () => {
        const token = req.headers.authorization;
        if (token !== "Bearer some token") {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify(`invalid bearer token: ${token}`));
          return;
        }

        if (
          req.method === "POST" &&
          req.url === "/_apis/artifactcache/caches"
        ) {
          const data = JSON.parse(rawData);
          if (data.message == "some message") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "some other message" }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(`invalid message: ${data.message}`));
          }
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(`unknown resource: ${req.method} on ${req.url}`),
        );
      });
    });
    server.listen(12345);

    const res = await sendCacheApiRequest<{ message: string }>(
      "caches",
      { method: "POST" },
      { message: "some message" },
    );

    expect(res).toEqual([200, { message: "some other message" }]);

    server.close();
  });

  it("should fail to send a request to an invalid endpoint", async () => {
    const { sendCacheApiRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://invalid/";

    await expect(
      sendCacheApiRequest("caches", { method: "POST" }),
    ).rejects.toThrow();
  });
});
