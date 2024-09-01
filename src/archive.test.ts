import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compressFiles, extractFiles } from "./archive.js";

describe("compress and extract files", () => {
  let tempPath = "";
  beforeAll(async () => {
    tempPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), "temp-"));
  });

  let samplePath = "";
  let archivePath = "";
  it("should compress files to an arhive", async () => {
    // Create sample files.
    samplePath = path.join(tempPath, "sample");
    await fsPromises.mkdir(samplePath);
    await Promise.all([
      fsPromises.writeFile(path.join(samplePath, "a-file"), "a content"),
      fsPromises.writeFile(
        path.join(samplePath, "another-file"),
        "another content",
      ),
      (async () => {
        await fsPromises.mkdir(path.join(samplePath, "a-dir"));
        await fsPromises.writeFile(
          path.join(samplePath, "a-dir", "a-file"),
          "a content",
        );
      })(),
    ]);

    archivePath = path.join(tempPath, "archive.tar");
    await compressFiles(archivePath, [
      path.join(samplePath, "a-file"),
      path.join(samplePath, "another-file"),
      path.join(samplePath, "a-dir"),
    ]);

    // Check if the archive file exists and remove the sample files.
    await Promise.all([
      fsPromises.access(archivePath),
      fsPromises.rm(samplePath, { recursive: true }),
    ]);
  });

  it("should extract files from an archive", async () => {
    await extractFiles(archivePath);

    const contents = await Promise.all([
      fsPromises.readFile(path.join(samplePath, "a-file")),
      fsPromises.readFile(path.join(samplePath, "another-file")),
      fsPromises.readFile(path.join(samplePath, "a-dir", "a-file")),
    ]);

    expect(contents.map((content) => content.toString())).toEqual([
      "a content",
      "another content",
      "a content",
    ]);
  });

  afterAll(async () => {
    await fsPromises.rm(tempPath, { recursive: true });
  });
});
