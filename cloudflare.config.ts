import { bindings, defineConfig, defineWorker } from "cf/config";

const ALLOWED_PREVIEW_WORKER = "trustfive-preview";
const requestedWorker = process.env.TRUSTFIVE_CLOUDFLARE_WORKER?.trim();

if (requestedWorker && requestedWorker !== ALLOWED_PREVIEW_WORKER) {
  throw new Error(
    `Unsupported Cloudflare Worker destination "${requestedWorker}". Only the explicitly selected protected preview Worker "${ALLOWED_PREVIEW_WORKER}" is permitted by release tooling.`
  );
}

export default defineConfig({
  worker: defineWorker({
    name: requestedWorker || ALLOWED_PREVIEW_WORKER,
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-22",
    workersDev: false,
    previewUrls: false,
    domains: [
      {
        hostname: "preview.trustfive.co.uk",
        production: true,
        previews: false,
      },
    ],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
