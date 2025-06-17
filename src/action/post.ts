import { getInput, getState, logError, logInfo } from "gha-utils";
import { saveCache } from "../lib/cache.js";

try {
  if (getState("restored") === "true") {
    logInfo("Cache already restored, skipping cache save");
  } else {
    const key = getInput("key");
    const version = getInput("version");
    const filePaths = getInput("files")
      .split(/\s+/)
      .filter((arg) => arg != "");

    logInfo("Saving cache...");
    if (await saveCache(key, version, filePaths)) {
      logInfo("Cache successfully saved");
    } else {
      logInfo("Aborting cache save, cache already exists");
    }
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
