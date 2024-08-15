import { logError, logInfo } from "gha-utils";
import { sendCacheApiRequest } from "./api.js";

interface Caches {
  totalCount: number;
  artifactCaches: {
    id: number;
    cacheKey: string;
  }[];
}

try {
  logInfo("Getting caches information...");
  const [status, caches] = await sendCacheApiRequest<Caches>("caches", {
    method: "GET",
  });
  if (status !== 200) {
    throw new Error(`Failed to get caches information: ${status}`);
  }

  logInfo(`Found ${caches.totalCount} caches:`);
  for (const cache of caches.artifactCaches) {
    logInfo(`- ${cache.id} ${cache.cacheKey}`);
  }
} catch (err) {
  logError(err);
  process.exit(1);
}
