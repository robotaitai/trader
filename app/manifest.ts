import type { MetadataRoute } from "next";

// Web-app manifest so the site can be added to the home screen (iPad/iPhone)
// and behave like a standalone app. Asset URLs are prefixed with the deploy
// base path (e.g. /trader on GitHub Pages) so they resolve in every mode.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Required so the manifest is emitted as a static file under `output: export`.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Investor OS",
    short_name: "Investor OS",
    description: "Local-first portfolio analytics cockpit",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
