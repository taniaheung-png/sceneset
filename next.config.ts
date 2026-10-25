import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Scaffold enabled cacheComponents/partialPrefetching; off for simpler cookie-session (auth) pages. Revisit if caching is needed.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
