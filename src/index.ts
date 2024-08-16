import { getInput, logError, logInfo } from "gha-utils";
import { reserveCache } from "./cache.js";

try {
  logInfo("Reserving cache...");
  const cacheId = await reserveCache(
    getInput("key"),
    getInput("version"),
    parseInt(getInput("size"), 10),
  );
  logInfo(`Reserved cache with id: ${cacheId}`);
} catch (err) {
  logError(err);
  process.exit(1);
}
