import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server in .next/standalone for the Docker image.
  // The Dockerfile copies only that folder + .next/static + public into the
  // final image so the production container stays small.
  output: "standalone",

  // Allow Next.js Image to load from external avatars used in the chat /
  // expert profile flows (LinkedIn, Google, etc.).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
