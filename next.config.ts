import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.1.117"],
    // Produces a self-contained .next/standalone build (its own minimal
    // server.js + only the node_modules files actually used) — this is
    // what the Dockerfile copies into the image instead of the whole repo.
    output: "standalone",
    // ssh2 ships native-ish crypto assets that Turbopack can't bundle into
    // a Server Component chunk; run it as plain Node.js require() instead.
    serverExternalPackages: ["ssh2-sftp-client", "ssh2"],
};

export default nextConfig;
