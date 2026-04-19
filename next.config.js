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
}

module.exports = nextConfig
