import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Progress photos live in a private Supabase Storage bucket and are served
    // through short-lived signed URLs — next/image still needs the host
    // allow-listed (Report/06-deploy-vercel.md §8.3).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Fail the build on type errors rather than shipping them. This is the default;
  // stated explicitly so nobody relaxes it by accident. (Next.js 16 dropped the
  // `eslint` config key — lint runs as its own step, see `npm run lint`.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
