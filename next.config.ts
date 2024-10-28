import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  sassOptions: {
    // bulma 0.8 has a bunch of future deprecations, but the next version breaks a lot of stuff
    // so we ignore the deprecation warnings here. These
    silenceDeprecations: [
      "color-functions",
      "import",
      "global-builtin",
      "legacy-js-api",
      "slash-div",
    ],
    quietDeps: true,
  },
};

export default nextConfig;
