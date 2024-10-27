import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
  { input: "src/main.ts", dir: "dist" },
  { input: "src/post.ts", dir: "dist" },
  { input: "src/restore/main.ts", dir: "dist/restore" },
  { input: "src/save/main.ts", dir: "dist/save" },
].map(({ input, dir }) => ({
  input,
  output: {
    dir,
    entryFileNames: "[name].bundle.mjs",
  },
  plugins: [nodeResolve(), typescript({ declaration: false, outDir: dir })],
}));
