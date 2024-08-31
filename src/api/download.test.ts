import { jest } from "@jest/globals";

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
      source: () => string,
      destination: (content: string) => void,
    ) => destination(source()),
  },
}));

jest.unstable_mockModule("./https.js", () => ({
  sendRequest: async (req: () => string) => () => clouds[req()],
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
