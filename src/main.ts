import { getInput, logError, logInfo, setOutput } from "gha-utils";
import { restoreCache } from "./lib.js";

try {
  const key = getInput("key");
  const version = getInput("version");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version)) {
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
