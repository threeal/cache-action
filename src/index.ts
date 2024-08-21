import { getInput, logError, logInfo } from "gha-utils";
import { restoreCache, saveCache } from "./cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");
  const filePath = getInput("file");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version, filePath)) {
    logInfo("Cache successfully restored");
    process.exit(0);
  }

  logInfo("Cache does not exist, saving...");
  await saveCache(key, version, filePath);
  logInfo("Cache successfully saved");
} catch (err) {
  logError(err);
  process.exit(1);
}
