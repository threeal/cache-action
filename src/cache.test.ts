import type http from "node:http";
import { jest } from "@jest/globals";

jest.unstable_mockModule("./api.js", () => ({
  handleJsonResponse: jest.fn(),
  sendJsonRequest: jest.fn(),
}));

describe("reserve caches", () => {
  it("should reserve a cache", async () => {
    const { handleJsonResponse, sendJsonRequest } = await import("./api.js");
    const { reserveCache } = await import("./cache.js");

    jest.mocked(handleJsonResponse).mockResolvedValue({ cacheId: 32 });
    jest.mocked(sendJsonRequest).mockResolvedValue({
      statusCode: 201,
    } as unknown as http.IncomingMessage);

    const cacheId = await reserveCache("some-key", "some-version", 1024);

    expect(sendJsonRequest).toHaveBeenCalledTimes(1);
    expect(sendJsonRequest).toHaveBeenCalledWith(
      "caches",
      { method: "POST" },
      { key: "some-key", version: "some-version", cacheSize: 1024 },
    );

    expect(handleJsonResponse).toHaveBeenCalledTimes(1);
    expect(handleJsonResponse).toHaveBeenCalledWith({ statusCode: 201 });

    expect(cacheId).toBe(32);
  });

  it("should fail to reserve a cache", async () => {
    const { sendJsonRequest } = await import("./api.js");
    const { reserveCache } = await import("./cache.js");

    jest.mocked(sendJsonRequest).mockResolvedValue({
      statusCode: 500,
    } as unknown as http.IncomingMessage);

    await expect(
      reserveCache("some-key", "some-version", 1024),
    ).rejects.toThrow("failed to reserve cache: 500");
  });
});
