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

## License

This project is licensed under the terms of the [MIT License](./LICENSE).

Copyright © 2024 [Alfi Maulana](https://github.com/threeal)
