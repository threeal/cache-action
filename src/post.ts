import { getInput, logError, logInfo } from "gha-utils";
import { saveCache } from "./lib.js";

try {
  const key = getInput("key");
  const version = getInput("version");
  const filePaths = getInput("files")
    .split(/\s+/)
    .filter((arg) => arg != "");

  logInfo("Saving cache...");
  if (await saveCache(key, version, filePaths)) {
    logInfo("Cache successfully saved");
  } else {
    logInfo("Cache already exists");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
