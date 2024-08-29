import { getInput, logError, logInfo } from "gha-utils";
import { saveCache } from "./cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");
  const filePath = getInput("file");

  logInfo("Saving cache...");
  if (await saveCache(key, version, filePath)) {
    logInfo("Cache successfully saved");
  } else {
    logInfo("Cache already exists");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
