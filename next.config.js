/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',      // generates static files in `out/` for Cloudflare Pages
  trailingSlash: true,   // required for Cloudflare Pages static file routing
  images: {
    unoptimized: true,   // image optimisation requires a server — disabled for static export
  },
}

module.exports = nextConfig
