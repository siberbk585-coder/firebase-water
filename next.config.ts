import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN-origin access to dev assets when testing on other devices.
  allowedDevOrigins: ["192.168.137.20", "192.168.137.70"],
  serverExternalPackages: ["sharp", "tesseract.js", "@google-cloud/cloud-sql-connector"],
};

export default nextConfig;
