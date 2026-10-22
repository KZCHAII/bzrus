import type { NextConfig } from "next";

const htmlHeaders = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // 화면은 public/의 HTML 그대로 (BZR과 같은 방식). 첫 화면은 index.html, 지도는 /m/<slug>.
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      { source: "/m/:slug", destination: "/map.html" },
      { source: "/reading", destination: "/reading.html" },
    ];
  },
  async headers() {
    return [
      { source: "/:page*.html", headers: htmlHeaders },
      { source: "/", headers: htmlHeaders },
      { source: "/m/:slug", headers: htmlHeaders },
      { source: "/reading", headers: htmlHeaders },
      { source: "/js/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/css/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
