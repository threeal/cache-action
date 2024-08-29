import { getInput, logError, logInfo, setOutput } from "gha-utils";
import { restoreCache } from "./cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");
  const filePath = getInput("file");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version, filePath)) {
    logInfo("Cache successfully restored");
    setOutput("restored", "true");
  } else {
    logInfo("Cache does not exist");
    setOutput("restored", "false");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
