import { jest } from "@jest/globals";

class MockedRequest {
  headers: Record<string, string> = {};

  #writtenData = "";
  data?: string;

  #onResponse?: (res: any) => void;
  #onError?: (err: Error) => void;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  write(chunk: any): void {
    this.#writtenData += chunk;
  }

  end(): void {
    this.data = this.#writtenData;
  }

  on(event: string, callback: any): void {
    switch (event) {
      case "response":
        this.#onResponse = callback;
        break;

      case "error":
        this.#onError = callback;
        break;
    }
  }

  response(res: any): void {
    if (this.#onResponse !== undefined) this.#onResponse(res);
  }

  error(err: Error): void {
    if (this.#onError !== undefined) this.#onError(err);
  }
}

class MockedResponse {
  #onData?: (chunk: any) => void;
  #onEnd?: () => void;

  on(event: string, callback: any): void {
    switch (event) {
      case "data":
        this.#onData = callback;
        break;

      case "end":
        this.#onEnd = callback;
        break;
    }
  }

  data(chunk: any): void {
    if (this.#onData !== undefined) this.#onData(chunk);
  }

  end(): void {
    if (this.#onEnd !== undefined) this.#onEnd();
  }
}

const https = {
  request: jest.fn(),
};

jest.unstable_mockModule("node:https", () => ({ default: https }));

describe("create HTTPS requests for the GitHub cache API endpoint", () => {
  it("should create an HTTPS request", async () => {
    const { createRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://localhost:12345/";
    process.env["ACTIONS_RUNTIME_TOKEN"] = "some token";

    https.request.mockImplementation((url, options) => {
      expect(url).toBe("http://localhost:12345/_apis/artifactcache/resources");
      expect(options).toBe("some options");
      return new MockedRequest();
    });

    const req = createRequest("resources", "some options" as any) as any;

    expect(req.headers).toEqual({
      Accept: "application/json;api-version=6.0-preview",
      Authorization: "Bearer some token",
    });
  });
});

describe("send HTTPS requests containing JSON data", () => {
  it("should send an HTTPS request", async () => {
    const { sendJsonRequest } = await import("./api.js");

    const req = new MockedRequest();
    const prom = sendJsonRequest(req as any, { message: "some message" });

    req.response("some response");

    await expect(prom).resolves.toBe("some response");
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
    expect(req.data).toBe(JSON.stringify({ message: "some message" }));
  });

  it("should fail to send an HTTPS request", async () => {
    const { sendJsonRequest } = await import("./api.js");

    process.env["ACTIONS_CACHE_URL"] = "http://invalid/";

    const req = new MockedRequest();
    const prom = sendJsonRequest(req as any, {});

    req.error(new Error("some error"));

    await expect(prom).rejects.toThrow("some error");
  });
});

describe("handle HTTPS responses containing JSON data", () => {
  it("should handle an HTTPS response", async () => {
    const { handleJsonResponse } = await import("./api.js");

    const res = new MockedResponse();
    const prom = handleJsonResponse(res as any);

    res.data(JSON.stringify({ message: "some message" }));
    res.end();

    await expect(prom).resolves.toEqual({ message: "some message" });
  });
});

describe("handle HTTPS responses containing error data", () => {
  it("should handle an HTTPS response", async () => {
    const { handleErrorResponse } = await import("./api.js");

    const res = new MockedResponse();
    const prom = handleErrorResponse(res as any);

    res.data(JSON.stringify({ message: "some error" }));
    res.end();

    await expect(prom).resolves.toEqual(new Error("some error"));
  });
});
