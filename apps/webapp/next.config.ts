import type { NextConfig } from "next";
import path from "path";

const stripVerboseConsole =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_DEBUG_LOGS !== "true";

const nextConfig: NextConfig = {
  /* config options here */
  // Required for Firebase App Hosting (Cloud Run) - uses standalone output
  output: "standalone",
  ...(stripVerboseConsole
    ? {
        compiler: {
          // Strip debug/info/log in prod unless NEXT_PUBLIC_DEBUG_LOGS=true (see apphosting.*.yaml)
          removeConsole: { exclude: ["error", "warn"] },
        },
      }
    : {}),
  // Monorepo: trace deps from workspace root so hoisted packages are included.
  // Post-build script (fix-firebase-standalone.js) restructures output for
  // Firebase adapter compatibility.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Removed @asset-mem/common dependency - types and contexts are now local to webapp
  // for Firebase App Hosting compatibility
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.gstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.gettyimages.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
