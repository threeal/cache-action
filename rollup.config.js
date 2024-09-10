import { nodeResolve } from "@rollup/plugin-node-resolve";
import { builtinModules } from "node:module";
import ts from "rollup-plugin-ts";

const output = {
  dir: "dist",
  entryFileNames: "[name].mjs",
};

export default [
  {
    input: "src/lib.ts",
    output,
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
    output,
    plugins: [nodeResolve(), ts({ transpileOnly: true })],
  },
  {
    input: "src/post.ts",
    output,
    plugins: [nodeResolve(), ts({ transpileOnly: true })],
  },
];
