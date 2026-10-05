/** @type {import('next').NextConfig} */
const workspacePaths = ['login', 'signup', 'forgot-password', 'chat', 'tools', 'guide', 'keys', 'news', 'exa'];
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      ...workspacePaths.map(path => ({
        source: `/${path}`,
        destination: `https://agents-sdk.space/${path}`,
        permanent: false,
      })),
      { source: '/docs/:path*', destination: 'https://agents-sdk.space/docs/:path*', permanent: false },
      { source: '/blog', destination: 'https://agents-sdk.space/news', permanent: false },
      { source: '/showcase', destination: '/#features', permanent: false },
    ];
  },
};
export default nextConfig;
