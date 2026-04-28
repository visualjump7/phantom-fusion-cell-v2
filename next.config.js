/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['pwtwuhynfqieaegfvyna.supabase.co'],
  },
  // node-ical (and its transitive `rrule`) touch BigInt at module init and
  // get mangled by webpack into broken `e.BigInt(...)` calls. Externalize so
  // Next.js requires them at runtime via Node instead of bundling.
  // (Next 15 renamed this to top-level `serverExternalPackages`.)
  experimental: {
    serverComponentsExternalPackages: ['node-ical', 'rrule'],
  },
  // Old URLs still work so bookmarks / deep links don't 404.
  // The new hub lives at /comms with Alerts and Chat tabs.
  async redirects() {
    return [
      // Principal side
      { source: '/messages', destination: '/comms/alerts', permanent: true },
      { source: '/messages/:path*', destination: '/comms/alerts/:path*', permanent: true },
      { source: '/chat', destination: '/comms/chat', permanent: true },
      { source: '/chat/:path*', destination: '/comms/chat/:path*', permanent: true },
      // Admin side (per-workspace)
      { source: '/admin/client/:orgId/messages', destination: '/admin/client/:orgId/comms/alerts', permanent: true },
      { source: '/admin/client/:orgId/messages/:path*', destination: '/admin/client/:orgId/comms/alerts/:path*', permanent: true },
      { source: '/admin/client/:orgId/chat', destination: '/admin/client/:orgId/comms/chat', permanent: true },
      { source: '/admin/client/:orgId/chat/:path*', destination: '/admin/client/:orgId/comms/chat/:path*', permanent: true },
    ];
  },
}

module.exports = nextConfig
