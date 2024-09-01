import crypto from "node:crypto";
import { jest } from "@jest/globals";

interface Cloud {
  data: string;
  size: number;
  committed: boolean;
}

type File = string | Directory | undefined;
interface Directory extends Record<string, File> {}

const cacheIds: Record<string, number | undefined> = {};
const cacheUrls: Record<number, string | undefined> = {};
const clouds: Record<string, Cloud | undefined> = {};
let root: Directory = {};

const getFile = (root: Directory, path: string): File => {
  let file: File = root;
  for (const subPath of path.split("/")) {
    if (file === undefined || typeof file === "string") return undefined;
    file = file[subPath];
  }
  return file;
};

const setFile = (root: Directory, path: string, file: File): void => {
  const subPaths = path.split("/");
  const lastSubPath = subPaths.pop();
  if (lastSubPath === undefined) return;
  let subDir: Directory = root;
  for (const subPath of subPaths) {
    if (subDir[subPath] === undefined) subDir[subPath] = {};
    if (typeof subDir[subPath] === "string") subDir[subPath] = {};
    subDir = subDir[subPath];
  }
  subDir[lastSubPath] = file;
};

jest.unstable_mockModule("node:fs", () => ({
  default: {
    createReadStream: (
      path: string,
      options: { start: number; end: number },
    ) => {
      const file = getFile(root, path);
      if (file === undefined) throw new Error(`path ${path} does not exist`);
      if (typeof file !== "string")
        throw new Error(`path ${path} is a directory`);
      return file.substring(options.start, options.end);
    },
  },
}));

jest.unstable_mockModule("node:fs/promises", () => ({
  default: {
    stat: async (path: string) => {
      const file = getFile(root, path);
      if (file === undefined) throw new Error(`path ${path} does not exist`);
      if (typeof file !== "string")
        throw new Error(`path ${path} is a directory`);
      return { size: file.length };
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

    setFile(root, savePath, cloud.data);
  },
}));

jest.unstable_mockModule("./archive.js", () => ({
  compressFiles: async (archivePath: string, filePaths: string[]) => {
    const archive = {};
    for (const filePath of filePaths) {
      setFile(archive, filePath, getFile(root, filePath));
    }
    setFile(root, archivePath, JSON.stringify({ archive, filePaths }));
  },
  extractFiles: async (archivePath: string) => {
    const file = getFile(root, archivePath);
    if (file === undefined)
      throw new Error(`path ${archivePath} does not exist`);
    if (typeof file !== "string")
      throw new Error(`path ${archivePath} is a directory`);

    const { archive, filePaths } = JSON.parse(file);
    for (const filePath of filePaths) {
      setFile(root, filePath, getFile(archive, filePath));
    }
  },
}));

describe("save and restore files from caches", () => {
  beforeEach(() => {
    root = {};
  });

  it("should save files to a cache", async () => {
    const { saveCache } = await import("./cache.js");

    root = {
      "a-file": "a content",
      "another-file": "another content",
      "a-dir": {
        "a-file": "a content",
        "another-file": "another content",
      },
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

    root = {
      "a-file": "a content",
      "another-file": "another content",
      "a-dir": {
        "a-file": "a content",
        "another-file": "another content",
      },
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
    root["cache.tar"] = undefined;

    expect(root).toEqual({
      "a-file": "a content",
      "another-file": "another content",
      "a-dir": {
        "a-file": "a content",
      },
    });
  });

  it("should not restore files from a non-existing cache", async () => {
    const { restoreCache } = await import("./cache.js");

    const restored = await restoreCache("another-key", "another-version");
    expect(restored).toBe(false);

    expect(root).toEqual({});
  });
});
