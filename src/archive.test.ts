import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compressFiles, extractFiles } from "./archive.js";

describe("compress and extract files", () => {
  let tempDir = "";
  beforeAll(async () => {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  });

  let archivePath = "";
  it("should compress files to an arhive", async () => {
    await fsPromises.access(tempDir);
    await Promise.all([
      fsPromises.writeFile(path.join(tempDir, "a-file"), "a content"),
      fsPromises.writeFile(
        path.join(tempDir, "another-file"),
        "another content",
      ),
      (async () => {
        await fsPromises.mkdir(path.join(tempDir, "a-dir"));
        await fsPromises.writeFile(
          path.join(tempDir, "a-dir", "a-file"),
          "a content",
        );
      })(),
    ]);

    archivePath = path.join(tempDir, "archive.tar");
    await compressFiles(archivePath, [
      path.join(tempDir, "a-file"),
      path.join(tempDir, "another-file"),
      path.join(tempDir, "a-dir", "a-file"),
    ]);

    await fsPromises.access(archivePath);
  });

  it("should extract files from an archive", async () => {
    await fsPromises.access(archivePath);
    await Promise.all([
      fsPromises.rm(path.join(tempDir, "a-file")),
      fsPromises.rm(path.join(tempDir, "a-file")),
      fsPromises.rm(path.join(tempDir, "a-dir"), { recursive: true }),
    ]);

    await extractFiles(archivePath);

    await Promise.all([
      expect(
        fsPromises.readFile(path.join(tempDir, "a-file"), {
          encoding: "utf-8",
        }),
      ).resolves.toBe("a content"),
      expect(
        fsPromises.readFile(path.join(tempDir, "another-file"), {
          encoding: "utf-8",
        }),
      ).resolves.toBe("another content"),
      expect(
        fsPromises.readFile(path.join(tempDir, "a-dir", "a-file"), {
          encoding: "utf-8",
        }),
      ).resolves.toBe("a content"),
    ]);
  });

  afterAll(async () => {
    await fsPromises.rm(tempDir, { recursive: true });
  });
});
