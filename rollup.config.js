import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const config = {
  input: "lib/index.js",
  output: {
    esModule: true,
    dir: "dist",
    format: "es",
    sourcemap: false
  },
  plugins: [commonjs(), json(), nodeResolve({ preferBuiltins: true })]
};

export default config;
