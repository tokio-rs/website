/**
 * @type {import('next').NextConfig}
 **/
export default {
  webpack: (config) => {

    config.resolve.fallback = { fs: false };

    return config;
  }
};

