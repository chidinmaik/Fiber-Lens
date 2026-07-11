/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CCC (Common Chains Connector) uses Web Components (Lit) and WASM.
  // Next.js needs these experiments enabled for the connector to work.
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
