import http from "node:http";
import stream from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("assert content type of HTTP incoming messages", () => {
  it("should assert the content type", async () => {
    const { assertIncomingMessageContentType } = await import("./http.js");

    const res = { headers: { "content-type": "a-content-type" } };
    assertIncomingMessageContentType(res as any, "a-content-type");
  });

  it("should fail to assert the content type", async () => {
    const { assertIncomingMessageContentType } = await import("./http.js");

    expect(() => {
      const res = { headers: { "content-type": "another-content-type" } };
      assertIncomingMessageContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type to be 'a-content-type', but instead got 'another-content-type'",
    );

    expect(() => {
      const res = { headers: {} };
      assertIncomingMessageContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type to be 'a-content-type', but instead got 'undefined'",
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

  it("should echo and discard raw data", async () => {
    const { sendRequest, waitIncomingMessage } = await import("./http.js");

    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendRequest(req, "a message");
    expect(res.statusCode).toBe(200);

    await waitIncomingMessage(res);
  });

  it("should echo raw data", async () => {
    const { readIncomingMessage, sendRequest } = await import("./http.js");

    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendRequest(req, "a message");
    expect(res.statusCode).toBe(200);

    const buffer = await readIncomingMessage(res);
    expect(buffer.toString()).toBe("a message");
  });

  it("should echo JSON data", async () => {
    const { readJsonIncomingMessage, sendJsonRequest } = await import(
      "./http.js"
    );

    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendJsonRequest(req, { message: "a message" });
    expect(res.statusCode).toBe(200);

    const data = await readJsonIncomingMessage(res);
    expect(data).toEqual({
      message: "a message",
    });
  });

  it("should echo a binary stream", async () => {
    const { readIncomingMessage, sendStreamRequest } = await import(
      "./http.js"
    );

    const bin = stream.Readable.from("a message");
    const req = http.request("http://localhost:10001/echo", { method: "POST" });

    const res = await sendStreamRequest(req, bin, 16, 32);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-range"]).toBe("bytes 16-32/*");

    const buffer = await readIncomingMessage(res);
    expect(buffer.toString()).toBe("a message");
  });

  describe("echo error data", () => {
    it("should echo empty error data", async () => {
      const { readErrorIncomingMessage, sendRequest } = await import(
        "./http.js"
      );

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });

      const res = await sendRequest(req);
      expect(res.statusCode).toBe(500);

      const err = await readErrorIncomingMessage(res);
      expect(err).toEqual(new Error("unknown error (500)"));
    });

    it("should echo error data in JSON", async () => {
      const { readErrorIncomingMessage, sendJsonRequest } = await import(
        "./http.js"
      );

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });

      const res = await sendJsonRequest(req, { message: "an error" });
      expect(res.statusCode).toBe(500);

      const err = await readErrorIncomingMessage(res);
      expect(err).toEqual(new Error("an error (500)"));
    });

    it("should echo error data in XML", async () => {
      const { readErrorIncomingMessage, sendRequest } = await import(
        "./http.js"
      );

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });
      req.setHeader("content-type", "application/xml");

      const res = await sendRequest(req, "<?xml><Message>an error</Message>");
      expect(res.statusCode).toBe(500);

      const err = await readErrorIncomingMessage(res);
      expect(err).toEqual(new Error("an error (500)"));
    });

    it("should echo error data in unknown type", async () => {
      const { readErrorIncomingMessage, sendRequest } = await import(
        "./http.js"
      );

      const req = http.request("http://localhost:10001/echo-error", {
        method: "POST",
      });

      const res = await sendRequest(req, "an error");
      expect(res.statusCode).toBe(500);

      const err = await readErrorIncomingMessage(res);
      expect(err).toEqual(new Error("an error (500)"));
    });
  });

  afterAll(() => server.close());
});
