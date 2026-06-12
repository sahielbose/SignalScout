/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Checkpoints gate on `pnpm typecheck` (tsc) + tests + evals, not on lint.
  // Keep `next build` from failing on lint so deploys are deterministic.
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['pg-boss', 'postgres'],
  experimental: {
    // Auth.js v5 + node deps used in route handlers
  },
};

export default nextConfig;
