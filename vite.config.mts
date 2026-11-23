import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),
    {
      name: "trustfive-cloudflare-ssr-entry",
      apply: "build",
      enforce: "post",
      renderChunk(code) {
        if (this.environment.name !== "rsc") return null;
        // vinext references the default Vite extension, but the Cloudflare
        // plugin emits the SSR Worker entry as an ES module with .mjs.
        const patched = code.replaceAll("./ssr/index.js", "./ssr/index.mjs");
        return patched === code ? null : { code: patched, map: null };
      },
    },
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
