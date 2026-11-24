import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

// `ANALYZE=1 npm run build -w client` also writes a bundle report to
// client/dist/stats.html (raw, gzip and brotli size of every module).
const plugins: PluginOption[] = [react(), tailwindcss()];
if (process.env.ANALYZE === "1") {
  plugins.push(visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true, template: "treemap" }));
  plugins.push(visualizer({ filename: "dist/stats.json", gzipSize: true, template: "raw-data" }));
}

export default defineConfig({
  plugins,
  // Read VITE_* variables from the single .env file at the repo root.
  envDir: "..",
});
