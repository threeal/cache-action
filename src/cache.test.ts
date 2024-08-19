import { jest } from "@jest/globals";

const createRequest = jest.fn();
const handleErrorResponse = jest.fn();
const handleJsonResponse = jest.fn();
const handleResponse = jest.fn();
const sendJsonRequest = jest.fn();
const sendStreamRequest = jest.fn();

jest.unstable_mockModule("./api.js", () => ({
  createRequest,
  handleErrorResponse,
  handleJsonResponse,
  handleResponse,
  sendJsonRequest,
  sendStreamRequest,
}));

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
