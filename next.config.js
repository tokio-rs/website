module.exports = {
  target: "serverless",
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = { ...(await originalEntry()) };
        entries["./scripts/generate-rss-feed.js"] = "./scripts/generate-rss-feed.js";
        return entries;
      };
    }
    return config;
  },
};

