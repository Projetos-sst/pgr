import type { NextConfig } from "next";

const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const CLERK_HOSTS = [
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "https://*.clerk.services",
  "https://img.clerk.com",
  "https://clerk-telemetry.com",
];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLERK_HOSTS.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CLERK_HOSTS.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CLERK_HOSTS.join(" ")}`,
  `frame-src 'self' ${CLERK_HOSTS.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const baseSecurityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        source: "/api/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/__clerk/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/dashboard/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/sign-in/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/sign-up/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
