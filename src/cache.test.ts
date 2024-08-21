import { jest } from "@jest/globals";

const getCache = jest.fn();
jest.unstable_mockModule("./api/cache.js", () => ({ getCache }));

const downloadFile = jest.fn();
jest.unstable_mockModule("./api/download.js", () => ({ downloadFile }));

describe("restore caches", () => {
  it("it should restore a cache", async () => {
    const { restoreCache } = await import("./cache.js");

    getCache.mockImplementation(async (key, version) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      return { archiveLocation: "some URL" };
    });

    downloadFile.mockImplementation(async (url, savePath) => {
      expect(url).toBe("some URL");
      expect(savePath).toBe("some file path");
    });

    const restored = await restoreCache(
      "some key",
      "some version",
      "some file path",
    );
    expect(restored).toBe(true);
  });

  it("it should not restore a cache", async () => {
    const { restoreCache } = await import("./cache.js");

    getCache.mockImplementation(async (key, version) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      return null;
    });

    downloadFile.mockImplementation(async () => {
      throw new Error("some error");
    });

    const restored = await restoreCache(
      "some key",
      "some version",
      "some file path",
    );
    expect(restored).toBe(false);
  });
});
