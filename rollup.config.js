import { nodeResolve } from "@rollup/plugin-node-resolve";
import { builtinModules } from "node:module";
import ts from "rollup-plugin-ts";

export default [
  {
    input: "src/lib.ts",
    output: {
      dir: "dist",
    },
    plugins: [
      ts({
        tsconfig: (config) => ({ ...config, declaration: true }),
        transpileOnly: true,
      }),
    ],
    external: builtinModules.map((module) => `node:${module}`),
  },
  {
    input: "src/main.ts",
    output: {
      dir: "dist",
      entryFileNames: "[name].mjs",
    },
    plugins: [nodeResolve(), ts({ transpileOnly: true })],
  },
  {
    input: "src/post.ts",
    output: {
      dir: "dist",
      entryFileNames: "[name].mjs",
    },
    plugins: [nodeResolve(), ts({ transpileOnly: true })],
  },
  {
    input: "restore/src/main.ts",
    output: {
      dir: "restore/dist",
      entryFileNames: "[name].mjs",
    },
    plugins: [nodeResolve(), ts({ transpileOnly: true })],
  },
];
