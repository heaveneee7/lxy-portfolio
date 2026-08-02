import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const githubPagesBase = "/lxy-portfolio/";

export default defineConfig({
  base: githubPagesBase,
  plugins: [
    react(),
    {
      name: "github-pages-public-assets",
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type === "chunk") {
            output.code = output.code.replace(
              /(?<!\/lxy-portfolio)\/assets\//g,
              `${githubPagesBase}assets/`,
            );
          } else if (typeof output.source === "string") {
            output.source = output.source.replace(
              /(?<!\/lxy-portfolio)\/assets\//g,
              `${githubPagesBase}assets/`,
            );
          }
        }
      },
    },
  ],
  publicDir: "public",
  build: {
    outDir: "dist-github",
    emptyOutDir: true,
  },
});
