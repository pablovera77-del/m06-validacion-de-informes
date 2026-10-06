import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel limita el cuerpo de cada solicitud a 4,5 MB: los PDF se suben en tandas de hasta 4 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // unpdf usa pdf.js; se mantiene fuera del bundle del servidor.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
