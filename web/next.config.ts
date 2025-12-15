import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: "http://127.0.0.1:8000/api/:path*", // Laravel
            },
        ];
    },

    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: "http",
                hostname: "127.0.0.1",
                port: "8000",
                pathname: "/storage/**",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "8000",
                pathname: "/storage/**",
            },
        ],
    },
};

export default nextConfig;
