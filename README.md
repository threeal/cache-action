# Cache Action

Save and restore files as a cache in [GitHub Actions](https://github.com/features/actions). Use this action to cache dependencies or build outputs to speed up GitHub Actions workflows.

By default, this action will attempt to restore files from a cache if it exists; otherwise, it will save files to a cache at the end of the workflow run.

## Available Inputs

| Name      | Value Type       | Description                                            |
| --------- | ---------------- | ------------------------------------------------------ |
| `key`     | String           | The cache key.                                         |
| `version` | String           | The cache version.                                     |
| `files`   | Multiple Strings | The files to be cached, separated by space or newline. |

## Available Outputs

| Name       | Value Type        | Description                                                             |
| ---------- | ----------------- | ----------------------------------------------------------------------- |
| `restored` | `true` or `false` | A boolean value indicating whether the cache was successfully restored. |

### Example Usages

The following example demonstrates how to use this action to cache [Node.js](https://nodejs.org/) dependencies in a GitHub Action workflow:

```yaml
name: Build
on:
  push:
jobs:
  build-project:
    name: Build Project
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Project
        uses: actions/checkout@v4.1.7

      - name: Cache Dependencies
        id: cache-deps
        uses: threeal/cache-action@v0.1.0
        with:
          key: node-deps
          version: ${{ hashFiles('package-lock.json') }}
          files: node_modules

      - name: Install Dependencies
        if: steps.cache-deps.outputs.restored == 'false'
        run: npm install

      # Do something
```

This action will attempt to restore a cache with the key `node-deps` and a version specified by the hash of the `package-lock.json` file. If the cache exists, it will restore the `node_modules` directory and skip dependency installation; otherwise, it will install the dependencies and later save the `node_modules` to the cache at the end of the workflow run.

## License

This project is licensed under the terms of the [MIT License](./LICENSE).

Copyright © 2024 [Alfi Maulana](https://github.com/threeal)
