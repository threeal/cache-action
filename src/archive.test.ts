import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compressFiles, extractFiles } from "./archive.js";

describe("compress and extract files", () => {
  let tempDir = "";
  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "temp-"));
  });

  let archivePath = "";
  it("should compress files to an arhive", async () => {
    await fs.access(tempDir);
    await Promise.all([
      fs.writeFile(path.join(tempDir, "a-file"), "a content"),
      fs.writeFile(path.join(tempDir, "another-file"), "another content"),
      (async () => {
        await fs.mkdir(path.join(tempDir, "a-dir"));
        await fs.writeFile(path.join(tempDir, "a-dir", "a-file"), "a content");
      })(),
    ]);

    archivePath = path.join(tempDir, "archive.tar");
    await compressFiles(archivePath, [
      path.join(tempDir, "a-file"),
      path.join(tempDir, "another-file"),
      path.join(tempDir, "a-dir", "a-file"),
    ]);

    await fs.access(archivePath);
  });

  it("should extract files from an archive", async () => {
    await fs.access(archivePath);
    await Promise.all([
      fs.rm(path.join(tempDir, "a-file")),
      fs.rm(path.join(tempDir, "a-file")),
      fs.rm(path.join(tempDir, "a-dir"), { recursive: true }),
    ]);

    await extractFiles(archivePath);

    await Promise.all([
      expect(
        fs.readFile(path.join(tempDir, "a-file"), { encoding: "utf-8" }),
      ).resolves.toBe("a content"),
      expect(
        fs.readFile(path.join(tempDir, "another-file"), { encoding: "utf-8" }),
      ).resolves.toBe("another content"),
      expect(
        fs.readFile(path.join(tempDir, "a-dir", "a-file"), {
          encoding: "utf-8",
        }),
      ).resolves.toBe("a content"),
    ]);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true });
  });
});
