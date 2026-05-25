import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN-origin access to dev assets when testing on other devices.
  allowedDevOrigins: ["192.168.137.20", "192.168.137.70"],
  serverExternalPackages: ["sharp", "tesseract.js", "@google-cloud/cloud-sql-connector", "@resvg/resvg-js"],
  // Bundle TTF fonts vào server runtime (cho PDF generation trên Cloud Run).
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./public/fonts/*.ttf"],
  },
};

export default nextConfig;
