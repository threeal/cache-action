# Restore Cache Action

Use the following snippet to include the action in a GitHub workflow:

```yaml
- name: Restore Dependencies Cache
  uses: threeal/cache-action/restore@v0.3.0
  with:
    key: a-key
    version: a-version
```

By default, the action will attempt to restore files from a cache if it exists. It will set an output that indicates whether the cache was successfully restored.

## Available Inputs

| Name      | Value Type | Description        |
| --------- | ---------- | ------------------ |
| `key`     | String     | The cache key.     |
| `version` | String     | The cache version. |

## Available Outputs

| Name       | Value Type        | Description                                                             |
| ---------- | ----------------- | ----------------------------------------------------------------------- |
| `restored` | `true` or `false` | A boolean value indicating whether the cache was successfully restored. |

## Example Usage

The following example demonstrates how to use the action to restore [Node.js](https://nodejs.org/) dependencies cache in a GitHub Action workflow:

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
        uses: actions/checkout@v4.2.1

      - name: Restore Dependencies Cache
        id: restore-deps-cache
        uses: threeal/cache-action/restore@v0.3.0
        with:
          key: node-deps
          version: ${{ hashFiles('package-lock.json') }}

      - name: Install Dependencies
        if: steps.restore-deps-cache.outputs.restored == 'false'
        run: npm install

      # Do something
```

This action will attempt to restore a cache with the key `node-deps` and a version specified by the hash of the `package-lock.json` file. If the cache exists, it will restore the `node_modules` directory and skip dependency installation. Otherwise, it will install the dependencies using `npm`.
