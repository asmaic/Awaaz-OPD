import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // API routes read these at runtime with fs (golden demo answers, cases, golden fixtures); make sure deploys ship them.
  outputFileTracingIncludes: { "/api/**/*": ["./fixtures/**/*"] },
  partialPrefetching: true,
  reactCompiler: true,
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
