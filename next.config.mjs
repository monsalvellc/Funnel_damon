

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This also helps avoid build failures due to type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;