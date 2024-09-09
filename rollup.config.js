import { nodeResolve } from "@rollup/plugin-node-resolve";
import ts from "rollup-plugin-ts";

export default ["src/main.ts", "src/post.ts"].map((input) => ({
  input,
  output: {
    dir: "dist",
    entryFileNames: "[name].mjs",
  },
  plugins: [nodeResolve(), ts({ transpileOnly: true })],
}));
