import { jest } from "@jest/globals";

class Writable {
  #writtenData = "";
  data?: string;

  write(chunk: any): void {
    this.#writtenData += chunk;
  }

  end(): void {
    this.data = this.#writtenData;
  }
}

class Request extends Writable {
  headers: Record<string, string> = {};

  #onResponse?: (res: any) => void;
  #onError?: (err: Error) => void;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
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

class Readable {
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

  write(chunk: any): void {
    if (this.#onData !== undefined) this.#onData(chunk);
  }

  end(): void {
    if (this.#onEnd !== undefined) this.#onEnd();
  }

  pipe(writable: Writable): void {
    this.on("data", (chunk: any) => writable.write(chunk));
    this.on("end", () => writable.end());
  }
}

class Response extends Readable {
  statusCode: number;
  headers: Record<string, string | undefined>;

  #onError?: (err: Error) => void;

  constructor(
    statusCode?: number,
    headers?: Record<string, string | undefined>,
  ) {
    super();
    this.statusCode = statusCode ?? 200;
    this.headers = headers ?? {};
  }

  on(event: string, callback: any): void {
    switch (event) {
      case "error":
        this.#onError = callback;
        break;

      default:
        super.on(event, callback);
    }
  }

  error(err: Error): void {
    if (this.#onError !== undefined) this.#onError(err);
  }
}

describe("create HTTPS requests for the GitHub cache API endpoint", () => {
  it("should create an HTTPS request", async () => {
    const https = { request: jest.fn() };
    jest.unstable_mockModule("node:https", () => ({ default: https }));

    const { createRequest } = await import("./https.js");

    process.env["ACTIONS_CACHE_URL"] = "a-url/";
    process.env["ACTIONS_RUNTIME_TOKEN"] = "a-token";

    https.request.mockImplementation((url, options) => {
      expect(url).toBe("a-url/_apis/artifactcache/resources");
      expect(options).toBe("some options");
      return new Request();
    });

    const req = createRequest("resources", "some options" as any) as any;

    expect(req.headers).toEqual({
      Accept: "application/json;api-version=6.0-preview",
      Authorization: "Bearer a-token",
    });
  });
});

describe("send HTTPS requests containing raw data", () => {
  it("should send an HTTPS request", async () => {
    const { sendRequest } = await import("./https.js");

    const req = new Request();
    const prom = sendRequest(req as any, "a message");

    req.response("a response");

    await expect(prom).resolves.toBe("a response");
    expect(req.headers).toEqual({});
    expect(req.data).toBe("a message");
  });

  it("should fail to send an HTTPS request", async () => {
    const { sendRequest } = await import("./https.js");

    const req = new Request();
    const prom = sendRequest(req as any);

    req.error(new Error("an error"));

    await expect(prom).rejects.toThrow("an error");
  });
});

describe("send HTTPS requests containing JSON data", () => {
  it("should send an HTTPS request", async () => {
    const { sendJsonRequest } = await import("./https.js");

    const req = new Request();
    const prom = sendJsonRequest(req as any, { message: "a message" });

    req.response("a response");

    await expect(prom).resolves.toBe("a response");
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
    expect(req.data).toBe(JSON.stringify({ message: "a message" }));
  });
});

describe("send HTTPS requests containing binary streams", () => {
  it("should send an HTTPS request", async () => {
    const { sendStreamRequest } = await import("./https.js");

    const req = new Request();
    const bin = new Readable();
    const prom = sendStreamRequest(req as any, bin as any, 0, 1024);

    bin.write("a message");
    bin.end();

    req.response("a response");

    await expect(prom).resolves.toBe("a response");
    expect(req.headers).toEqual({
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 0-1024/*",
    });
    expect(req.data).toBe("a message");
  });

  it("should fail to send an HTTPS request", async () => {
    const { sendStreamRequest } = await import("./https.js");

    const req = new Request();
    const bin = new Readable();
    const prom = sendStreamRequest(req as any, bin as any, 0, 1024);

    req.error(new Error("an error"));

    await expect(prom).rejects.toThrow("an error");
  });
});

describe("assert content type of HTTP responses", () => {
  it("should assert the content type of an HTTP response", async () => {
    const { assertResponseContentType } = await import("./https.js");

    const res = new Response(200, { "content-type": "a-content-type" });
    assertResponseContentType(res as any, "a-content-type");
  });

  it("should fail to assert the content type of HTTP responses", async () => {
    const { assertResponseContentType } = await import("./https.js");

    expect(() => {
      const res = new Response(200, {
        "content-type": "another-content-type",
      });
      assertResponseContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type of the response to be 'a-content-type', but instead got 'another-content-type'",
    );

    expect(() => {
      const res = new Response();
      assertResponseContentType(res as any, "a-content-type");
    }).toThrow(
      "expected content type of the response to be 'a-content-type', but instead got 'undefined'",
    );
  });
});

describe("handle HTTPS responses containing raw data", () => {
  it("should handle an HTTPS response", async () => {
    const { handleResponse } = await import("./https.js");

    const res = new Response();
    const prom = handleResponse(res as any);

    res.write("a message");
    res.end();

    await expect(prom).resolves.toEqual("a message");
  });

  it("should fail to handle an HTTPS response", async () => {
    const { handleResponse } = await import("./https.js");

    const res = new Response();
    const prom = handleResponse(res as any);

    res.error(new Error("an error"));

    await expect(prom).rejects.toThrow("an error");
  });
});

describe("handle HTTPS responses containing JSON data", () => {
  it("should handle an HTTPS response", async () => {
    const { handleJsonResponse } = await import("./https.js");

    const res = new Response(200, { "content-type": "application/json" });
    const prom = handleJsonResponse(res as any);

    res.write(JSON.stringify({ message: "a message" }));
    res.end();

    await expect(prom).resolves.toEqual({ message: "a message" });
  });
});

describe("handle HTTPS responses containing error data", () => {
  it("should handle an HTTPS response containing error data in JSON", async () => {
    const { handleErrorResponse } = await import("./https.js");

    const res = new Response(500, { "content-type": "application/json" });
    const prom = handleErrorResponse(res as any);

    res.write(JSON.stringify({ message: "an error" }));
    res.end();

    await expect(prom).resolves.toEqual(new Error("an error (500)"));
  });

  it("should handle an HTTPS response containing error data in XML", async () => {
    const { handleErrorResponse } = await import("./https.js");

    const res = new Response(500, { "content-type": "application/xml" });
    const prom = handleErrorResponse(res as any);

    res.write("<?xml><Message>an error</Message>");
    res.end();

    await expect(prom).resolves.toEqual(new Error("an error (500)"));
  });

  it("should handle an HTTPS response containing error data in string", async () => {
    const { handleErrorResponse } = await import("./https.js");

    const res = new Response(500);
    const prom = handleErrorResponse(res as any);

    res.write("an error");
    res.end();

    await expect(prom).resolves.toEqual(new Error("an error (500)"));
  });
});
