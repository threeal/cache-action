import { jest } from "@jest/globals";

interface Request {
  url: string;
  method: string;
}

interface Response {
  headers: Record<string, string | undefined>;
  statusCode: number;
  data: () => string;
}

let clouds: Partial<Record<string, string>> = {};
let files: Partial<Record<string, string>> = {};
beforeEach(() => {
  clouds = {};
  files = {};
});

jest.unstable_mockModule("node:fs", () => ({
  default: {
    createWriteStream: (path: string) => {
      return (content: string) => (files[path] = content);
    },
  },
}));

jest.unstable_mockModule("node:https", () => ({
  default: {
    request: (url: string, { method }: any): Request => ({ url, method }),
  },
}));

jest.unstable_mockModule("node:stream/promises", () => ({
  default: {
    pipeline: async (
      source: Response,
      destination: (content: string) => void,
    ) => destination(source.data()),
  },
}));

jest.unstable_mockModule("./https.js", () => ({
  assertResponseContentType: (res: Response, expectedType: string) => {
    expect(res.headers["content-type"]).toContain(expectedType);
  },
  handleErrorResponse: async (res: Response) => new Error(res.data()),
  handleResponse: async (res: Response) => res.data(),
  sendRequest: async (req: Request): Promise<Response> => {
    const data = clouds[req.url];
    if (data === undefined) {
      return { statusCode: 404, headers: {}, data: () => "not found" };
    }

    if (req.method === "HEAD") {
      return {
        statusCode: 200,
        headers: { "content-length": data.length.toString() },
        data: () => "",
      };
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-length": data.length.toString(),
      },
      data: () => data,
    };
  },
}));

describe("get the size of files to be downloaded", () => {
  it("should return the size of a file to be downloaded", async () => {
    const { getDownloadFileSize } = await import("./download.js");

    clouds["a-url"] = "a content";

    const fileSize = await getDownloadFileSize("a-url");
    expect(fileSize).toBe(clouds["a-url"].length);
  });

  it("should throw an error for an invalid URL", async () => {
    const { getDownloadFileSize } = await import("./download.js");

    const prom = getDownloadFileSize("an-invalid-url");
    await expect(prom).rejects.toThrow("not found");
  });
});

describe("download files", () => {
  it("should download a file successfully", async () => {
    const { downloadFile } = await import("./download.js");

    clouds["a-url"] = "a content";

    await downloadFile("a-url", "a-file");

    expect(files).toEqual({ "a-file": "a content" });
  });

  it("should throw an error for an invalid URL", async () => {
    const { downloadFile } = await import("./download.js");

    const prom = downloadFile("an-invalid-url", "a-file");
    await expect(prom).rejects.toThrow("not found");
  });
});
