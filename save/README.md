# Save Cache Action

Use the following snippet to include the action in a GitHub workflow:

```yaml
- name: Save Dependencies Cache
  uses: threeal/cache-action/save@v0.3.0
  with:
    key: a-key
    version: a-version
    files: a-file another-file
```

By default, the action will save files to a cache if it does not already exist. It will set an output indicating whether the cache was successfully saved.

## Available Inputs

| Name      | Value Type       | Description                                              |
| --------- | ---------------- | -------------------------------------------------------- |
| `key`     | String           | The cache key.                                           |
| `version` | String           | The cache version.                                       |
| `files`   | Multiple Strings | The files to be cached, separated by spaces or newlines. |

## Available Outputs

| Name    | Value Type        | Description                                                          |
| ------- | ----------------- | -------------------------------------------------------------------- |
| `saved` | `true` or `false` | A boolean value indicating whether the cache was successfully saved. |

## Example Usage

The following example demonstrates how to use the action to save [Node.js](https://nodejs.org/) dependencies as a cache in a GitHub Action workflow:

```yaml
name: Build
on:
  push:
jobs:
  build-project:
    name: Build Project
    runs-on: ubuntu-22.04
    steps:
      - name: Checkout Project
        uses: actions/checkout@v4.2.1

      - name: Install Dependencies
        run: npm install

      - name: Save Dependencies to Cache
        uses: threeal/cache-action/save@v0.3.0
        with:
          key: node-deps
          version: ${{ hashFiles('package-lock.json') }}
          files: node_modules

      # Do something
```

This action will install the project dependencies and then save the `node_modules` directory to a cache with the `node-deps` key and a version specified by the hash of the `package-lock.json` file.
