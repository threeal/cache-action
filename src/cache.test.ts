import type http from "node:http";
import { jest } from "@jest/globals";

jest.unstable_mockModule("./api.js", () => ({
  createRequest: jest.fn(),
  handleErrorResponse: jest.fn(),
  handleJsonResponse: jest.fn(),
  sendJsonRequest: jest.fn(),
}));

describe("reserve caches", () => {
  it("should reserve a cache", async () => {
    const { createRequest, handleJsonResponse, sendJsonRequest } = await import(
      "./api.js"
    );
    const { reserveCache } = await import("./cache.js");

    jest
      .mocked(createRequest)
      .mockReturnValue("some request" as unknown as http.ClientRequest);

    jest.mocked(handleJsonResponse).mockResolvedValue({ cacheId: 32 });

    jest.mocked(sendJsonRequest).mockResolvedValue({
      statusCode: 201,
    } as unknown as http.IncomingMessage);

    const cacheId = await reserveCache("some-key", "some-version", 1024);

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledWith("caches", { method: "POST" });

    expect(sendJsonRequest).toHaveBeenCalledTimes(1);
    expect(sendJsonRequest).toHaveBeenCalledWith("some request", {
      key: "some-key",
      version: "some-version",
      cacheSize: 1024,
    });

    expect(handleJsonResponse).toHaveBeenCalledTimes(1);
    expect(handleJsonResponse).toHaveBeenCalledWith({ statusCode: 201 });

    expect(cacheId).toBe(32);
  });

  it("should fail to reserve a cache", async () => {
    const { createRequest, handleErrorResponse, sendJsonRequest } =
      await import("./api.js");
    const { reserveCache } = await import("./cache.js");

    jest
      .mocked(createRequest)
      .mockReturnValue("some request" as unknown as http.ClientRequest);

    jest.mocked(handleErrorResponse).mockResolvedValue(new Error("some error"));

    jest.mocked(sendJsonRequest).mockResolvedValue({
      statusCode: 500,
    } as unknown as http.IncomingMessage);

    await expect(
      reserveCache("some-key", "some-version", 1024),
    ).rejects.toThrow("some error");
  });
});
