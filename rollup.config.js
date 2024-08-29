import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default ["src/main.ts", "src/post.ts"].map((input) => ({
  input,
  output: {
    dir: "dist",
    entryFileNames: "[name].mjs",
  },
  plugins: [nodeResolve(), typescript()],
}));
