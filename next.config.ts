import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Avatar service used by the seed data. Restricted to a specific host so
      // we don't accidentally allow optimization of arbitrary user-controlled URLs.
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default nextConfig;
