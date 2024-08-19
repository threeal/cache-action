import { getInput, logError, logInfo } from "gha-utils";
import fs from "node:fs";
import { commitCache, getCache, reserveCache, uploadCache } from "./cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");

  logInfo("Getting cache...");
  const cache = await getCache(key, version);
  if (cache !== null) {
    logInfo("Cache exists, skipping upload...");
    process.exit(0);
  }

  const filePath = getInput("file");
  const fileSize = fs.statSync(filePath).size;

  logInfo("Reserving cache...");
  const cacheId = await reserveCache(key, version, fileSize);
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
