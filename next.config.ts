import type { NextConfig } from "next";

// Security headers applied to every response. CSP is intentionally omitted:
// the app loads Leaflet tiles and external favicons, and a private cockpit
// behind auth gains little from a strict CSP versus the breakage risk.
const securityHeaders = [
  // The app is never embedded in an iframe — block clickjacking entirely.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is used by the Rastreador map ("usar mi ubicación").
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // Salida autocontenida para Docker: empaqueta solo lo necesario en
  // .next/standalone y se ejecuta con `node server.js`. Ver Dockerfile.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
