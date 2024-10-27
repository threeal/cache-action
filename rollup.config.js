import { nodeResolve } from "@rollup/plugin-node-resolve";
import ts from "rollup-plugin-ts";

export default [
  {
    input: "src/main.ts",
    output: {
      dir: "dist",
      entryFileNames: "[name].bundle.mjs",
    },
    plugins: [
      nodeResolve(),
      ts({
        tsconfig: (config) => ({ ...config, declaration: false }),
        transpileOnly: true,
      }),
    ],
  },
  {
    input: "src/post.ts",
    output: {
      dir: "dist",
      entryFileNames: "[name].bundle.mjs",
    },
    plugins: [
      nodeResolve(),
      ts({
        tsconfig: (config) => ({ ...config, declaration: false }),
        transpileOnly: true,
      }),
    ],
  },
  {
    input: "src/restore/main.ts",
    output: {
      dir: "dist/restore",
      entryFileNames: "[name].bundle.mjs",
    },
    plugins: [
      nodeResolve(),
      ts({
        tsconfig: (config) => ({ ...config, declaration: false }),
        transpileOnly: true,
      }),
    ],
  },
  {
    input: "src/save/main.ts",
    output: {
      dir: "dist/save",
      entryFileNames: "[name].bundle.mjs",
    },
    plugins: [
      nodeResolve(),
      ts({
        tsconfig: (config) => ({ ...config, declaration: false }),
        transpileOnly: true,
      }),
    ],
  },
];
