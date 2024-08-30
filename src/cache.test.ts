import { jest } from "@jest/globals";

const fs = {
  openSync: jest.fn(),
  createReadStream: jest.fn(),
  statSync: jest.fn(),
};
jest.unstable_mockModule("node:fs", () => ({ default: fs }));

const commitCache = jest.fn();
const getCache = jest.fn();
const reserveCache = jest.fn();
const uploadCache = jest.fn();
jest.unstable_mockModule("./api/cache.js", () => ({
  commitCache,
  getCache,
  reserveCache,
  uploadCache,
}));

const downloadFile = jest.fn();
jest.unstable_mockModule("./api/download.js", () => ({ downloadFile }));

const compressFiles = jest.fn();
const extractFiles = jest.fn();
jest.unstable_mockModule("./archive.js", () => ({
  compressFiles,
  extractFiles,
}));

describe("restore files from caches", () => {
  it("it should restore a file from a cache", async () => {
    const { restoreCache } = await import("./cache.js");

    getCache.mockImplementation(async (key, version) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      return { archiveLocation: "some URL" };
    });

    downloadFile.mockImplementation(async (url, savePath) => {
      expect(url).toBe("some URL");
      expect(savePath).toBe("cache.tar");
    });

    extractFiles.mockImplementation(async (archivePath) => {
      expect(archivePath).toBe("cache.tar");
    });

    const restored = await restoreCache("some key", "some version");
    expect(restored).toBe(true);
  });

  it("it should not restore a file from a cache", async () => {
    const { restoreCache } = await import("./cache.js");

    getCache.mockImplementation(async (key, version) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      return null;
    });

    downloadFile.mockImplementation(async () => {
      throw new Error("some error");
    });

    extractFiles.mockImplementation(async () => {
      throw new Error("some error");
    });

    const restored = await restoreCache("some key", "some version");
    expect(restored).toBe(false);
  });
});

describe("save files to caches", () => {
  it("it should save a file to a cache", async () => {
    const { saveCache } = await import("./cache.js");

    compressFiles.mockImplementation(async (archivePath, filePaths) => {
      expect(archivePath).toBe("cache.tar");
      expect(filePaths).toEqual(["some file path", "some other file path"]);
    });

    fs.statSync.mockImplementation((path) => {
      expect(path).toBe("cache.tar");
      return { size: 1024 };
    });

    reserveCache.mockImplementation(async (key, version, size) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      expect(size).toBe(1024);
      return 32;
    });

    fs.openSync.mockImplementation((path, flags) => {
      expect(path).toBe("cache.tar");
      expect(flags).toBe("r");
      return "some file";
    });

    fs.createReadStream.mockImplementation((path, option) => {
      expect(path).toBe("cache.tar");
      expect(option).toEqual({
        fd: "some file",
        autoClose: false,
        start: 0,
        end: 1024,
      });
      return "some file stream";
    });

    uploadCache.mockImplementation(async (id, file, fileSize) => {
      expect(id).toBe(32);
      expect(file).toBe("some file stream");
      expect(fileSize).toBe(1024);
    });

    commitCache.mockImplementation(async (id, size) => {
      expect(id).toBe(32);
      expect(size).toBe(1024);
    });

    const saved = await saveCache("some key", "some version", [
      "some file path",
      "some other file path",
    ]);
    expect(saved).toBe(true);
  });

  it("it should not save a file to a cache", async () => {
    const { saveCache } = await import("./cache.js");

    compressFiles.mockImplementation(async (archivePath, filePaths) => {
      expect(archivePath).toBe("cache.tar");
      expect(filePaths).toEqual(["some file path", "some other file path"]);
    });

    fs.statSync.mockImplementation((path) => {
      expect(path).toBe("cache.tar");
      return { size: 1024 };
    });

    reserveCache.mockImplementation(async (key, version, size) => {
      expect(key).toBe("some key");
      expect(version).toBe("some version");
      expect(size).toBe(1024);
      return null;
    });

    const saved = await saveCache("some key", "some version", [
      "some file path",
      "some other file path",
    ]);
    expect(saved).toBe(false);
  });
});
