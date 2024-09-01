import crypto from "node:crypto";
import { jest } from "@jest/globals";

interface Cloud {
  data: string;
  size: number;
  committed: boolean;
}

const cacheIds: Partial<Record<string, number>> = {};
const cacheUrls: Partial<Record<number, string>> = {};
const clouds: Partial<Record<string, Cloud>> = {};
let files: Partial<Record<string, string>> = {};

jest.unstable_mockModule("node:fs", () => ({
  default: {
    createReadStream: (
      path: string,
      options: { start: number; end: number },
    ) => {
      const content = files[path];
      if (content === undefined) throw new Error(`file ${path} does not exist`);
      return content.substring(options.start, options.end);
    },
  },
}));

jest.unstable_mockModule("node:fs/promises", () => ({
  default: {
    stat: async (path: string) => {
      const content = files[path];
      if (content === undefined) throw new Error(`file ${path} does not exist`);
      return { size: content.length };
    },
  },
}));

jest.unstable_mockModule("./api/cache.js", () => ({
  commitCache: async (id: number, size: number) => {
    const url = cacheUrls[id];
    if (url === undefined) throw new Error(`cache ${id} does not exist`);

    const cloud = clouds[url];
    if (cloud === undefined) throw new Error(`cloud ${url} does not exist`);

    cloud.data.substring(0, Math.min(cloud.size, size));
    cloud.committed = true;
  },
  getCache: async (key: string, version: string) => {
    const cacheId = cacheIds[key + version];
    if (cacheId === undefined) return null;

    const url = cacheUrls[cacheId];
    if (url === undefined) throw new Error(`cache ${cacheId} does not exist`);

    return { archiveLocation: url };
  },
  reserveCache: async (key: string, version: string, size: number) => {
    let cacheId = cacheIds[key + version];
    if (cacheId !== undefined) return null;

    let url = crypto.randomBytes(8).toString();
    while (clouds[url] !== undefined) {
      url = crypto.randomBytes(8).toString();
    }
    clouds[url] = { data: "", size, committed: false };

    cacheId = 0;
    while (cacheUrls[cacheId] !== undefined) ++cacheId;
    cacheUrls[cacheId] = url;

    cacheIds[key + version] = cacheId;
    return cacheId;
  },
  uploadCache: async (id: number, file: string, fileSize: number) => {
    const url = cacheUrls[id];
    if (url === undefined) throw new Error(`cache ${id} does not exist`);

    const cloud = clouds[url];
    if (cloud === undefined) {
      throw new Error(`cloud ${url} does not exist`);
    }

    if (cloud.committed) {
      throw new Error(`cloud ${url} has already been committed`);
    }

    cloud.data = file.substring(0, Math.min(cloud.size, fileSize));
  },
}));

jest.unstable_mockModule("./api/download.js", () => ({
  downloadFile: async (url: string, savePath: string) => {
    const cloud = clouds[url];
    if (cloud === undefined) throw new Error(`cloud ${url} does not exist`);

    if (!cloud.committed) {
      throw new Error(`cloud ${url} has not yet been committed`);
    }

    files[savePath] = cloud.data;
  },
}));

jest.unstable_mockModule("./archive.js", () => ({
  compressFiles: async (archivePath: string, filePaths: string[]) => {
    files[archivePath] = JSON.stringify(
      filePaths.map((filePath) => ({
        path: filePath,
        content: files[filePath],
      })),
    );
  },
  extractFiles: async (archivePath: string) => {
    const file = files[archivePath];
    if (!file) throw new Error(`file ${archivePath} does not exist`);

    const archives = JSON.parse(file) as {
      path: string;
      content: string | undefined;
    }[];
    for (const archive of archives) {
      files[archive.path] = archive.content;
    }
  },
}));

describe("save and restore files from caches", () => {
  beforeEach(() => {
    files = {};
  });

  it("should save files to a cache", async () => {
    const { saveCache } = await import("./cache.js");

    files = {
      "a-file": "a content",
      "another-file": "another content",
      "a-dir/a-file": "a content",
    };

    const saved = await saveCache("a-key", "a-version", [
      "a-file",
      "another-file",
      "a-dir/a-file",
    ]);
    expect(saved).toBe(true);
  });

  it("should not save files to an existing cache", async () => {
    const { saveCache } = await import("./cache.js");

    files = {
      "a-file": "a content",
      "another-file": "another content",
      "a-dir/a-file": "a content",
    };

    const saved = await saveCache("a-key", "a-version", [
      "a-file",
      "another-file",
      "a-dir/a-file",
    ]);
    expect(saved).toBe(false);
  });

  it("should restore files from a cache", async () => {
    const { restoreCache } = await import("./cache.js");

    const restored = await restoreCache("a-key", "a-version");
    expect(restored).toBe(true);

    // TODO: remove the downloaded archive after restoring cache.
    files["cache.tar"] = undefined;

    expect(files).toEqual({
      "a-file": "a content",
      "another-file": "another content",
      "a-dir/a-file": "a content",
    });
  });

  it("should not restore files from a non-existing cache", async () => {
    const { restoreCache } = await import("./cache.js");

    const restored = await restoreCache("another-key", "another-version");
    expect(restored).toBe(false);

    expect(files).toEqual({});
  });
});
