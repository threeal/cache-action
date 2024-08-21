import { jest } from "@jest/globals";

const fs = { createWriteStream: jest.fn() };
jest.unstable_mockModule("node:fs", () => ({ default: fs }));

const https = { request: jest.fn() };
jest.unstable_mockModule("node:https", () => ({ default: https }));

const stream = { pipeline: jest.fn() };
jest.unstable_mockModule("node:stream/promises", () => ({ default: stream }));

const sendRequest = jest.fn();
jest.unstable_mockModule("./https.js", () => ({ sendRequest }));

describe("download files", () => {
  it("it should download a file", async () => {
    const { downloadFile } = await import("./download.js");

    https.request.mockImplementation((url: any) => {
      expect(url).toBe("some URL");
      return "some request";
    });

    sendRequest.mockImplementation(async (req: any) => {
      expect(req).toBe("some request");
      return "some response";
    });

    fs.createWriteStream.mockImplementation((path) => {
      expect(path).toBe("some file path");
      return "some file stream";
    });

    stream.pipeline.mockImplementation(async (source, destination) => {
      expect(source).toBe("some response");
      expect(destination).toBe("some file stream");
    });

    await downloadFile("some URL", "some file path");
  });
});
