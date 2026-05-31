import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Keep ssh2 as a Node runtime dependency; avoid bundling native .node files.
    serverExternalPackages: ['ssh2'],
};

export default nextConfig;
