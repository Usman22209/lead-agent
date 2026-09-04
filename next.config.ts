import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "qrcode"],
};

export default nextConfig;

