import { jest } from "@jest/globals";

jest.unstable_mockModule("./api.js", () => ({
  sendCacheApiRequest: jest.fn(),
}));

describe("reserve caches", () => {
  it("should reserve a cache", async () => {
    const { sendCacheApiRequest } = await import("./api.js");
    const { reserveCache } = await import("./cache.js");

    jest.mocked(sendCacheApiRequest).mockResolvedValue([201, { cacheId: 32 }]);

    const cacheId = await reserveCache("some-key", "some-version", 1024);

    expect(sendCacheApiRequest).toHaveBeenCalledTimes(1);
    expect(sendCacheApiRequest).toHaveBeenCalledWith(
      "caches",
      { method: "POST" },
      { key: "some-key", version: "some-version", cacheSize: 1024 },
    );

    expect(cacheId).toBe(32);
  });

  it("should fail to reserve a cache", async () => {
    const { sendCacheApiRequest } = await import("./api.js");
    const { reserveCache } = await import("./cache.js");

    jest.mocked(sendCacheApiRequest).mockResolvedValue([409, { cacheId: 32 }]);

    await expect(
      reserveCache("some-key", "some-version", 1024),
    ).rejects.toThrow("failed to reserve cache: 409");
  });
});
