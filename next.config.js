/**
 * @type {import('next').NextConfig}
 **/
export default {
  output: 'export',
  webpack: (config) => {

    config.resolve.fallback = { fs: false };

    return config;
  }
};

