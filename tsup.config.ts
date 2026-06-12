import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/summarize.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: true,
  sourcemap: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
