import { jest } from "@jest/globals";

describe("restore files from a cache", () => {
  let logs: string[] = [];

  let outputs: Record<string, string | undefined> = {};
  let states: Record<string, string | undefined> = {};

  jest.unstable_mockModule("gha-utils", () => ({
    getInput(name: string): string {
      switch (name) {
        case "key":
          return "a-key";
        case "version":
          return "a-version";
      }
      return "";
    },
    logError(err: Error): void {
      logs.push(`::error::${err.message}`);
    },
    logInfo(message: string): void {
      logs.push(message);
    },
    async setOutput(name: string, value: string): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          outputs[name] = value;
          resolve();
        }, 100);
      });
    },
    async setState(name: string, value: string): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          states[name] = value;
          resolve();
        }, 100);
      });
    },
  }));

  let caches: Record<string, string[] | undefined> = {};
  let files: string[] = [];

  const restoreCache =
    jest.fn<(key: string, version: string) => Promise<boolean>>();

  jest.unstable_mockModule("./lib.js", () => ({ restoreCache }));

  beforeEach(() => {
    jest.resetModules();

    logs = [];

    outputs = {};
    states = {};

    caches = {};
    files = [];

    restoreCache.mockImplementation(async (key, version) => {
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          const restoredFiles = caches[`${key}-${version}`];
          if (restoredFiles === undefined) {
            resolve(false);
          } else {
            files.push(...restoredFiles);
            resolve(true);
          }
        }, 100);
      });
    });

    process.exitCode = undefined;
  });

  it("should restore files from a cache", async () => {
    caches["a-key-a-version"] = ["a-file", "another-file"];

    await import("./main.js");

    expect(logs).toEqual(["Restoring cache...", "Cache successfully restored"]);

    expect(outputs).toEqual({ restored: "true" });
    expect(states).toEqual({ restored: "true" });
    expect(files).toEqual(["a-file", "another-file"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("should not restore files from a non-existing cache", async () => {
    await import("./main.js");

    expect(logs).toEqual(["Restoring cache...", "Cache does not exist"]);

    expect(outputs).toEqual({ restored: "false" });
    expect(states).toEqual({ restored: "false" });
    expect(files).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  it("should fail to restore files from a cache", async () => {
    restoreCache.mockRejectedValue(new Error("unknown error"));

    await import("./main.js");

    expect(logs).toEqual(["Restoring cache...", "::error::unknown error"]);

    expect(outputs).toEqual({});
    expect(states).toEqual({});
    expect(files).toEqual([]);
    expect(process.exitCode).toBe(1);
  });
});
