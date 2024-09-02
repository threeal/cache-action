import { jest } from "@jest/globals";

interface Response {
  statusCode: number;
  data: string;
}

let files: Record<string, string | undefined> = {};
let requestHandler: (
  req: any,
  data: string,
  start: number,
  end: number,
) => Response;

beforeEach(() => {
  files = {};
  requestHandler = () => {
    throw new Error("Unimplemented");
  };
});

jest.unstable_mockModule("node:fs", () => ({
  default: {
    createReadStream: (path: string, options: any) => {
      const content = files[path];
      if (content === undefined) throw new Error(`path ${path} does not exist`);
      return () => content.substring(options.start, options.end + 1);
    },
  },
}));

jest.unstable_mockModule("./https.js", () => ({
  createRequest: (resourcePath: string, options: object) => {
    return { resourcePath, ...options };
  },
  handleErrorResponse: async (res: Response) => {
    return new Error(res.data);
  },
  handleJsonResponse: async (res: Response) => {
    return JSON.parse(res.data);
  },
  handleResponse: async (res: Response) => {
    return res.data;
  },
  sendJsonRequest: async (req: any, data: any) => {
    const jsonData = JSON.stringify(data);
    return requestHandler(req, jsonData, 0, jsonData.length - 1);
  },
  sendRequest: async (req: any, data?: string) => {
    if (data === undefined) data = "";
    return requestHandler(req, data, 0, data.length - 1);
  },
  sendStreamRequest: async (
    req: any,
    bin: () => string,
    start: number,
    end: number,
  ) => {
    return requestHandler(req, bin(), start, end);
  },
}));

describe("retrieve caches", () => {
  it("should retrieve a cache", async () => {
    const { getCache } = await import("./cache.js");

    requestHandler = (req, data) => {
      expect(req).toEqual({
        resourcePath: "cache?keys=a-key&version=a-version",
        method: "GET",
      });
      expect(data).toBe("");
      return { statusCode: 200, data: JSON.stringify("a cache") };
    };

    const cache = await getCache("a-key", "a-version");
    expect(cache).toBe("a cache");
  });

  it("should not retrieve a non-existing cache", async () => {
    const { getCache } = await import("./cache.js");

    requestHandler = () => ({ statusCode: 204, data: "" });

    const cache = await getCache("a-key", "a-version");
    expect(cache).toBeNull();
  });

  it("should fail to retrieve a cache", async () => {
    const { getCache } = await import("./cache.js");

    requestHandler = () => ({ statusCode: 500, data: "an error" });

    const prom = getCache("a-key", "a-version");
    await expect(prom).rejects.toThrow("an error");
  });
});

describe("reserve caches", () => {
  it("should reserve a cache", async () => {
    const { reserveCache } = await import("./cache.js");

    requestHandler = (req, data) => {
      expect(req).toEqual({
        resourcePath: "caches",
        method: "POST",
      });
      expect(JSON.parse(data)).toEqual({
        key: "a-key",
        version: "a-version",
        cacheSize: 4,
      });
      return { statusCode: 201, data: JSON.stringify({ cacheId: 32 }) };
    };

    const cacheId = await reserveCache("a-key", "a-version", 4);
    expect(cacheId).toBe(32);
  });

  it("should not reserve a reserved cache", async () => {
    const { reserveCache } = await import("./cache.js");

    requestHandler = () => ({ statusCode: 409, data: "" });

    const cacheId = await reserveCache("a-key", "a-version", 4);
    expect(cacheId).toBeNull();
  });

  it("should fail to reserve a cache", async () => {
    const { reserveCache } = await import("./cache.js");

    requestHandler = () => ({ statusCode: 500, data: "an error" });

    const prom = reserveCache("a-key", "a-version", 4);
    await expect(prom).rejects.toThrow("an error");
  });
});

describe("upload files to caches", () => {
  it("should upload a file to a cache", async () => {
    const { uploadCache } = await import("./cache.js");

    files["a-file"] = "lorem ipsum dolor sit amet";
    let uploadedData = "";

    requestHandler = (req, data, start, end) => {
      expect(req).toEqual({
        resourcePath: "caches/32",
        method: "PATCH",
      });

      uploadedData =
        uploadedData.substring(0, start) +
        data +
        uploadedData.substring(end + 1, uploadedData.length);

      return { statusCode: 204, data: "" };
    };

    await uploadCache(32, "a-file", files["a-file"].length, {
      maxChunkSize: 8,
    });
    expect(uploadedData).toBe("lorem ipsum dolor sit amet");
  });

  it("should fail to upload a file to a cache", async () => {
    const { uploadCache } = await import("./cache.js");

    files["a-file"] = "lorem ipsum dolor sit amet";

    requestHandler = () => ({ statusCode: 500, data: "an error" });

    const prom = uploadCache(32, "a-file", files["a-file"].length);
    await expect(prom).rejects.toThrow("an error");
  });
});

describe("commit caches", () => {
  it("should commit a cache", async () => {
    const { commitCache } = await import("./cache.js");

    requestHandler = (req, data) => {
      expect(req).toEqual({
        resourcePath: "caches/32",
        method: "POST",
      });
      expect(JSON.parse(data)).toEqual({ size: 4 });
      return { statusCode: 204, data: "" };
    };

    await commitCache(32, 4);
  });

  it("should fail to commit a cache", async () => {
    const { commitCache } = await import("./cache.js");

    requestHandler = () => ({ statusCode: 500, data: "an error" });

    const prom = commitCache(32, 4);
    await expect(prom).rejects.toThrow("an error");
  });
});
