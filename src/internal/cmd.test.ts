import { spawn } from "node:child_process";

import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createArchive,
  extractArchive,
  ProcessError,
  waitProcess,
} from "./cmd.js";

describe("wait processeses", { concurrent: true }, () => {
  it("should wait a successful process", async () => {
    const proc = spawn("node", ["--version"]);
    await waitProcess(proc);
  });

  it("should wait a failing process", async () => {
    const proc = spawn("node", ["--invalid"]);
    await expect(waitProcess(proc)).rejects.toThrow(ProcessError);
  });
});

describe("create and extract archives", () => {
  let tempDir: string;
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "temp-"));

    // Create sample files.
    await mkdir(path.join(tempDir, "foo"));
    await Promise.all([
      writeFile(path.join(tempDir, "foo", "foo"), "foofoo"),
      writeFile(path.join(tempDir, "foo", "bar"), "foobar"),
      (async () => {
        await mkdir(path.join(tempDir, "foo", "baz"));
        await writeFile(path.join(tempDir, "foo", "baz", "baz"), "foobazbaz");
      })(),
    ]);
  });

  it("should create a compressed archive from files", async () => {
    const archivePath = path.join(tempDir, "archive.tar");
    await createArchive(archivePath, [
      path.join(tempDir, "foo", "foo"),
      path.join(tempDir, "foo", "bar"),
      path.join(tempDir, "foo", "baz"),
    ]);

    // Check if the archive file exists and remove the sample files.
    await Promise.all([
      access(archivePath),
      rm(path.join(tempDir, "foo"), { recursive: true }),
    ]);
  });

  it("should extract files from a compressed archive", async () => {
    await extractArchive(path.join(tempDir, "archive.tar"));

    const contents = await Promise.all([
      readFile(path.join(tempDir, "foo", "foo")),
      readFile(path.join(tempDir, "foo", "bar")),
      readFile(path.join(tempDir, "foo", "baz", "baz")),
    ]);

    expect(contents.map((content) => content.toString())).toEqual([
      "foofoo",
      "foobar",
      "foobazbaz",
    ]);
  });

  afterAll(() => rm(tempDir, { recursive: true }));
});
