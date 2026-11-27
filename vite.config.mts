import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

const commitSha = process.env.TRUSTFIVE_BUILD_SHA;
if (commitSha !== undefined && !/^[a-f0-9]{40}$/.test(commitSha)) {
  throw new Error("TRUSTFIVE_BUILD_SHA must be a lowercase 40-character Git commit SHA");
}

export default defineConfig({
  define: {
    "process.env.TRUSTFIVE_BUILD_SHA": JSON.stringify(commitSha ?? ""),
  },
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
