/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Badges are local static PNGs — disable optimization to prevent 404s on cold starts
    unoptimized: true,
  },
};

module.exports = nextConfig;
