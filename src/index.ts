import { getInput, logError, logInfo } from "gha-utils";
import fs from "node:fs";
import { commitCache, reserveCache, uploadCache } from "./cache.js";

try {
  const filePath = getInput("file");
  const fileSize = fs.statSync(filePath).size;

  logInfo("Reserving cache...");
  const cacheId = await reserveCache(
    getInput("key"),
    getInput("version"),
    fileSize,
  );
  logInfo(`Cache reserved with id: ${cacheId}`);

  logInfo("Uploading cache...");
  const file = fs.createReadStream(filePath, {
    fd: fs.openSync(filePath, "r"),
    autoClose: false,
    start: 0,
    end: fileSize,
  });
  await uploadCache(cacheId, file, fileSize);
  logInfo("Cache uploaded");

  logInfo("Commiting cache...");
  await commitCache(cacheId, fileSize);
  logInfo("Cache committed");
} catch (err) {
  logError(err);
  process.exit(1);
}
