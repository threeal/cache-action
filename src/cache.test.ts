import { jest } from "@jest/globals";

const createRequest = jest.fn();
const handleErrorResponse = jest.fn();
const handleJsonResponse = jest.fn();
const handleResponse = jest.fn();
const sendJsonRequest = jest.fn();
const sendRequest = jest.fn();
const sendStreamRequest = jest.fn();

jest.unstable_mockModule("./api.js", () => ({
  createRequest,
  handleErrorResponse,
  handleJsonResponse,
  handleResponse,
  sendJsonRequest,
  sendRequest,
  sendStreamRequest,
}));

describe("retrieve caches", () => {
  beforeAll(() => {
    createRequest.mockImplementation((resourcePath, options) => {
      expect(resourcePath).toBe("cache?keys=some-key&version=some-version");
      expect(options).toEqual({ method: "GET" });
      return "some request";
    });
  });

  it("should retrieve a cache", async () => {
    const { getCache } = await import("./cache.js");

    sendRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toBeUndefined();
      return { statusCode: 200 };
    });

    handleJsonResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 200 });
      return "some cache";
    });

    const cache = await getCache("some-key", "some-version");
    expect(cache).toBe("some cache");
  });

  it("should retrieve a non-existing cache", async () => {
    const { getCache } = await import("./cache.js");

    sendRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toBeUndefined();
      return { statusCode: 204 };
    });

    handleResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 204 });
      return "";
    });

    const cache = await getCache("some-key", "some-version");
    expect(cache).toBeNull();
  });

  it("should fail to retrieve a cache", async () => {
    const { getCache } = await import("./cache.js");

    sendRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toBeUndefined();
      return { statusCode: 500 };
    });

    handleErrorResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 500 });
      return new Error("some error");
    });

    const prom = getCache("some-key", "some-version");
    await expect(prom).rejects.toThrow("some error");
  });
});

describe("reserve caches", () => {
  beforeAll(() => {
    createRequest.mockImplementation((resourcePath, options) => {
      expect(resourcePath).toBe("caches");
      expect(options).toEqual({ method: "POST" });
      return "some request";
    });
  });

  it("should reserve a cache", async () => {
    const { reserveCache } = await import("./cache.js");

    sendJsonRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toEqual({
        key: "some-key",
        version: "some-version",
        cacheSize: 1024,
      });
      return { statusCode: 201 };
    });

    handleJsonResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 201 });
      return { cacheId: 32 };
    });

    const cacheId = await reserveCache("some-key", "some-version", 1024);
    expect(cacheId).toBe(32);
  });

  it("should fail to reserve a cache", async () => {
    const { reserveCache } = await import("./cache.js");

    sendJsonRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toEqual({
        key: "some-key",
        version: "some-version",
        cacheSize: 1024,
      });
      return { statusCode: 500 };
    });

    handleErrorResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 500 });
      return new Error("some error");
    });

    const prom = reserveCache("some-key", "some-version", 1024);
    await expect(prom).rejects.toThrow("some error");
  });
});

describe("upload files to caches", () => {
  beforeAll(() => {
    createRequest.mockImplementation((resourcePath, options) => {
      expect(resourcePath).toBe("caches/32");
      expect(options).toEqual({ method: "PATCH" });
      return "some request";
    });
  });

  it("should upload a file to a cache", async () => {
    const { uploadCache } = await import("./cache.js");

    sendStreamRequest.mockImplementation(async (req, bin, start, end) => {
      expect(req).toBe("some request");
      expect(bin).toEqual("some file");
      expect(start).toBe(0);
      expect(end).toBe(1024);
      return { statusCode: 204 };
    });

    handleResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 204 });
    });

    await uploadCache(32, "some file" as any, 1024);
  });

  it("should fail to upload a file to a cache", async () => {
    const { uploadCache } = await import("./cache.js");

    sendStreamRequest.mockImplementation(async (req, bin, start, end) => {
      expect(req).toBe("some request");
      expect(bin).toEqual("some file");
      expect(start).toBe(0);
      expect(end).toBe(1024);
      return { statusCode: 500 };
    });

    handleErrorResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 500 });
      return new Error("some error");
    });

    const prom = uploadCache(32, "some file" as any, 1024);
    await expect(prom).rejects.toThrow("some error");
  });
});

describe("commit caches", () => {
  beforeAll(() => {
    createRequest.mockImplementation((resourcePath, options) => {
      expect(resourcePath).toBe("caches/32");
      expect(options).toEqual({ method: "POST" });
      return "some request";
    });
  });

  it("should commit a cache", async () => {
    const { commitCache } = await import("./cache.js");

    sendJsonRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toEqual({ size: 1024 });
      return { statusCode: 204 };
    });

    handleResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 204 });
    });

    await commitCache(32, 1024);
  });

  it("should fail to commit a cache", async () => {
    const { commitCache } = await import("./cache.js");

    sendJsonRequest.mockImplementation(async (req, data) => {
      expect(req).toBe("some request");
      expect(data).toEqual({ size: 1024 });
      return { statusCode: 500 };
    });

    handleErrorResponse.mockImplementation(async (res) => {
      expect(res).toEqual({ statusCode: 500 });
      return new Error("some error");
    });

    const prom = commitCache(32, 1024);
    await expect(prom).rejects.toThrow("some error");
  });
});
