import https from "node:https";

/**
 * Sends an HTTPS request to the GitHub cache API endpoint.
 *
 * @param resourcePath - The path of the resource to be accessed in the API.
 * @param options - The options for the HTTPS request (e.g., method, headers).
 * @param data - The data to be sent in the request body (optional).
 * @returns A promise that resolves to a tuple containing the response status
 * code and the parsed response data.
 */
export async function sendCacheApiRequest<T>(
  resourcePath: string,
  options: https.RequestOptions,
  data?: unknown,
): Promise<[number, T]> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${process.env["ACTIONS_CACHE_URL"]}_apis/artifactcache/${resourcePath}`,
      options,
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk.toString()));
        res.on("end", () => {
          resolve([res.statusCode as number, JSON.parse(data) as T]);
        });
      },
    );

    req.setHeader("Accept", "application/json;api-version=6.0-preview");
    req.setHeader(
      "Authorization",
      `Bearer ${process.env["ACTIONS_RUNTIME_TOKEN"]}`,
    );
    req.setHeader("Content-Type", "application/json");

    req.on("error", (err) => reject(err));

    if (data !== undefined) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}
