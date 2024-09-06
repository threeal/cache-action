import { jest } from "@jest/globals";
import http from "node:http";
import stream from "node:stream";

jest.unstable_mockModule("node:https", () => ({ default: http }));

describe("create HTTPS requests for the GitHub cache API endpoint", () => {
  it("should create an HTTPS request", async () => {
    const { createRequest } = await import("./https.js");

    process.env["ACTIONS_CACHE_URL"] = "http://localhost/";
    process.env["ACTIONS_RUNTIME_TOKEN"] = "a-token";

    const req = createRequest("resources", { method: "GET" });

    req.on("error", () => undefined);
    req.end();

    expect(req.protocol).toBe("http:");
    expect(req.host).toBe("localhost");
    expect(req.path).toBe("/_apis/artifactcache/resources");
    expect(req.getHeader("accept")).toBe(
      "application/json;api-version=6.0-preview",
    );
    expect(req.getHeader("authorization")).toBe("Bearer a-token");
  });
});

describe("assert content type of HTTP responses", () => {
  it("should assert the content type of an HTTP response", async () => {
    const { assertResponseContentType } = await import("./https.js");

    const res = { headers: { "content-type": "a-content-type" } };
    assertResponseContentType(res as any, "a-content-type");
  });

  it("should fail to assert the content type of HTTP responses", async () => {
    const { assertResponseContentType } = await import("./https.js");

    expect(() => {
      const res = { headers: { "content-type": "another-content-type" } };
      assertResponseContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type of the response to be 'a-content-type', but instead got 'another-content-type'",
    );

    expect(() => {
      const res = { headers: {} };
      assertResponseContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type of the response to be 'a-content-type', but instead got 'undefined'",
    );
  });
});

describe("echo HTTP requests", () => {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/echo") {
      res.writeHead(200, req.statusMessage, req.headers);
      req.pipe(res);
    } else if (req.method === "POST" && req.url === "/echo-error") {
      res.writeHead(500, req.statusMessage, req.headers);
      req.pipe(res);
    } else {
      res.writeHead(400);
      res.end("bad request");
    }
  });

  beforeAll(() => server.listen(10001));

  it("should echo raw data", async () => {
    const { handleResponse, sendRequest } = await import("./https.js");

    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendRequest(req, "a message");
    expect(res.statusCode).toBe(200);

    const data = await handleResponse(res);
    expect(data).toBe("a message");
  });

  it("should echo JSON data", async () => {
    const { handleJsonResponse, sendJsonRequest } = await import("./https.js");

    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendJsonRequest(req, { message: "a message" });
    expect(res.statusCode).toBe(200);

    const data = await handleJsonResponse(res);
    expect(data).toEqual({
      message: "a message",
    });
  });

  it("should echo a binary stream", async () => {
    const { handleResponse, sendStreamRequest } = await import("./https.js");

    const bin = stream.Readable.from("a message");
    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendStreamRequest(req, bin, 16, 32);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-range"]).toBe("bytes 16-32/*");

    const data = await handleResponse(res);
    expect(data).toBe("a message");
  });

  describe("echo error data", () => {
    it("should echo error data in JSON", async () => {
      const { handleErrorResponse, sendJsonRequest } = await import(
        "./https.js"
      );

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });

      const res = await sendJsonRequest(req, { message: "an error" });
      expect(res.statusCode).toBe(500);

      const err = await handleErrorResponse(res);
      expect(err).toEqual(new Error("an error (500)"));
    });

    it("should echo error data in XML", async () => {
      const { handleErrorResponse, sendRequest } = await import("./https.js");

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });
      req.setHeader("content-type", "application/xml");

      const res = await sendRequest(req, "<?xml><Message>an error</Message>");
      expect(res.statusCode).toBe(500);

      const err = await handleErrorResponse(res);
      expect(err).toEqual(new Error("an error (500)"));
    });

    it("should echo error data in unknown type", async () => {
      const { handleErrorResponse, sendRequest } = await import("./https.js");

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });

      const res = await sendRequest(req, "an error");
      expect(res.statusCode).toBe(500);

      const err = await handleErrorResponse(res);
      expect(err).toEqual(new Error("an error (500)"));
    });
  });

  afterAll(() => server.close());
});
