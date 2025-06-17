import { getInput, logError, logInfo, setOutput, setState } from "gha-utils";
import { restoreCache } from "../lib/cache.js";

try {
  const key = getInput("key");
  const version = getInput("version");

  logInfo("Restoring cache...");
  if (await restoreCache(key, version)) {
    logInfo("Cache successfully restored");
    await Promise.all([
      setOutput("restored", "true"),
      setState("restored", "true"),
    ]);
  } else {
    logInfo("Cache does not exist");
    await Promise.all([
      setOutput("restored", "false"),
      setState("restored", "false"),
    ]);
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
