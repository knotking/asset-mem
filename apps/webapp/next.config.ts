import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Required for Firebase App Hosting (Cloud Run) - uses standalone output
  output: "standalone",
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
  // Removed @homeapp/common dependency - types and contexts are now local to webapp
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
