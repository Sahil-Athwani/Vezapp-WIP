/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mysql2'],
  async headers() {
    // Allow the page to use the microphone for voice entry
    return [{ source: '/:path*', headers: [{ key: 'Permissions-Policy', value: 'microphone=(self)' }] }];
  },
};

export default nextConfig;
