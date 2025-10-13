/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Optionally, add a basePath if you'll deploy to a subdirectory
  // basePath: '/my-app',

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
