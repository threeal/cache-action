# Cache Action

Save and restore files as a cache in [GitHub Actions](https://github.com/features/actions). Use this project to cache dependencies or build outputs to speed up GitHub Actions workflows.

This project comprises two components: a GitHub Action that can be used directly in workflows and a [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) library that contains functions for use in a [JavaScript Action](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action).

## Using the GitHub Action

Use the following snippet to include the action in a GitHub workflow:

```yaml
- name: Cache Dependencies
  uses: threeal/cache-action@v0.3.0
  with:
    key: a-key
    version: a-version
    files: a-file another-file
```

By default, the action will attempt to restore files from a cache if it exists; otherwise, it will save files to a cache at the end of the workflow run.

To restore and save the cache in separate steps, refer to the [restore](https://github.com/threeal/cache-action/tree/v0.3.0/restore) and [save](https://github.com/threeal/cache-action/tree/v0.3.0/save) sub-actions.

### Available Inputs

| Name      | Value Type       | Description                                              |
| --------- | ---------------- | -------------------------------------------------------- |
| `key`     | String           | The cache key.                                           |
| `version` | String           | The cache version.                                       |
| `files`   | Multiple Strings | The files to be cached, separated by spaces or newlines. |

### Available Outputs

| Name       | Value Type        | Description                                                             |
| ---------- | ----------------- | ----------------------------------------------------------------------- |
| `restored` | `true` or `false` | A boolean value indicating whether the cache was successfully restored. |

### Example Usage

The following example demonstrates how to use the action to cache [Node.js](https://nodejs.org/) dependencies in a GitHub Action workflow:

```yaml
name: Build
on:
  push:
jobs:
  build-project:
    name: Build Project
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout Project
        uses: actions/checkout@v4.2.2

      - name: Cache Dependencies
        id: cache-deps
        uses: threeal/cache-action@v0.3.0
        with:
          key: node-deps
          version: ${{ hashFiles('package-lock.json') }}
          files: node_modules

      - name: Install Dependencies
        if: steps.cache-deps.outputs.restored == 'false'
        run: npm install

      # Do something
```

This action will attempt to restore a cache with the key `node-deps` and a version specified by the hash of the `package-lock.json` file. If the cache exists, it will restore the `node_modules` directory and skip dependency installation. Otherwise, it will install the dependencies and save the `node_modules` to the cache at the end of the workflow run.

## Using the JavaScript Library

Install the JavaScript library using a package manager:

```bash
npm install cache-action
```

Import the functions using the import statement:

```js
import { restoreCache, saveCache } from "cache-action";

const restored = await restoreCache("a-key", "a-version");
if (!restored) {
  // Do something...

  await saveCache("a-key", "a-version", ["a-file", "another-file"]);
}
```

The library provides two functions: `restoreCache` for restoring files from a cache and `saveCache` for saving files to a cache. Refer to the library documentation [here](https://threeal.github.io/cache-action/modules.html) for more details on function usage.

## License

This project is licensed under the terms of the [MIT License](./LICENSE).

Copyright © 2024-2025 [Alfi Maulana](https://github.com/threeal)
