import { jest } from "@jest/globals";

interface Response {
  headers: Record<string, string | undefined>;
  data: () => string;
}

let clouds: Partial<Record<string, string>> = {};
let files: Partial<Record<string, string>> = {};

jest.unstable_mockModule("node:fs", () => ({
  default: {
    createWriteStream: (path: string) => {
      return (content: string) => (files[path] = content);
    },
  },
}));

jest.unstable_mockModule("node:https", () => ({
  default: {
    request: (url: string) => () => url,
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
  sendRequest: async (req: () => string) => ({
    headers: { "content-type": "application/octet-stream" },
    data: () => clouds[req()],
  }),
}));

describe("download files", () => {
  beforeEach(() => {
    clouds = {};
    files = {};
  });

  it("it should download a file", async () => {
    const { downloadFile } = await import("./download.js");

    clouds["a-url"] = "a content";

    await downloadFile("a-url", "a-file");

    expect(files).toEqual({ "a-file": "a content" });
  });
});
