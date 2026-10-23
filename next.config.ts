import type { NextConfig } from "next";

const htmlHeaders = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // 화면은 public/의 HTML 그대로 (BZR과 같은 방식). 첫 화면은 index.html, 지도는 /m/<slug>.
  // 예전 주소(bzrus.vercel.app)로 들어오면 withsaju.com 으로. API는 그대로 둔다 (결제사 알림 등이 끊기지 않게)
  async redirects() {
    return [
      { source: "/:path((?!api/).*)", has: [{ type: "host", value: "bzrus.vercel.app" }], destination: "https://withsaju.com/:path", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      { source: "/reading", destination: "/reading.html" },
      { source: "/r/:id", destination: "/r.html" },
      { source: "/find", destination: "/find.html" },
      { source: "/admin", destination: "/admin.html" },
      { source: "/refund", destination: "/refund.html" },
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/terms", destination: "/terms.html" },
    ];
  },
  async headers() {
    return [
      { source: "/:page*.html", headers: htmlHeaders },
      { source: "/", headers: htmlHeaders },
      { source: "/m/:slug", headers: htmlHeaders },
      { source: "/reading", headers: htmlHeaders },
      { source: "/r/:id", headers: htmlHeaders },
      { source: "/find", headers: htmlHeaders },
      { source: "/admin", headers: [...htmlHeaders, { key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/refund", headers: htmlHeaders },
      { source: "/privacy", headers: htmlHeaders },
      { source: "/terms", headers: htmlHeaders },
      { source: "/js/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/css/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
