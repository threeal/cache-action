import { getInput, logError, logInfo, setOutput } from "gha-utils";
import { restoreCache } from "../../src/lib.js";

try {
  const key = getInput("key");
  const version = getInput("version");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version)) {
    logInfo("Cache successfully restored");
    await setOutput("restored", "true");
  } else {
    logInfo("Cache does not exist");
    await setOutput("restored", "false");
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
