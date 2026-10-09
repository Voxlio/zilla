/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Enable web workers
    if (!isServer) {
      config.output.globalObject = 'self';
    }
    return config;
  },
  eslint: {
    // Disable ESLint during build to avoid blocking
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
