import type { NextConfig } from "next";

// Cache Components is off: every page depends on the signed-in household, so
// there is nothing useful to prerender. Pages render per request.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" }, // workbook uploads for import
  },
  // Optional: let browsers reach Supabase through this app at /supabase/* (used for
  // previews where the database is only reachable from the server). Also an option
  // if only one domain can be reached from a network. Off unless SUPABASE_PROXY_TARGET is set.
  async rewrites() {
    const target = process.env.SUPABASE_PROXY_TARGET;
    return target ? [{ source: "/supabase/:path*", destination: `${target.replace(/\/$/, "")}/:path*` }] : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
