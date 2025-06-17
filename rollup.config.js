import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
  "src/action/main.ts",
  "src/action/post.ts",
  "src/action/restore.ts",
  "src/action/save.ts",
].map((input) => ({
  input,
  output: {
    dir: "dist/action",
    entryFileNames: "[name].bundle.mjs",
  },
  plugins: [nodeResolve(), typescript()],
}));
