import { getInput, logError, logInfo, setOutput } from "gha-utils";
import { saveCache } from "../lib/cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");
  const filePaths = getInput("files")
    .split(/\s+/)
    .filter((arg) => arg != "");

  logInfo("Saving cache...");
  if (await saveCache(key, version, filePaths)) {
    logInfo("Cache successfully saved");
    await setOutput("saved", "true");
  } else {
    logInfo("Aborting cache save, cache already exists");
    await setOutput("saved", "false");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
