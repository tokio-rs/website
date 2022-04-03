// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const libs = [
  ["Tokio", "/tokio/tutorial", "https://github.com/tokio-rs/tokio"],
  ["Hyper", "https://docs.rs/hyper", "https://github.com/hyperium/hyper"],
  ["Tonic", "https://docs.rs/tonic", "https://github.com/hyperium/tonic"],
  ["Tower", "https://docs.rs/tower", "https://github.com/tower-rs/tower"],
  ["Mio", "https://docs.rs/mio", "https://github.com/tokio-rs/mio"],
  [
    "Tracing",
    "https://docs.rs/tracing",
    "https://github.com/tokio-rs/tracing",
  ],
].map(([name, docs, github]) => {
  return {
    title: name,
    items: [{ label: "Docs", href: docs }, { label: "GitHub", href: github }],
  }
})

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Tokio',
  tagline: 'An asynchronous Rust runtime',
  url: 'https://tokio.rs',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'tokio-rs', // Usually your GitHub org/user name.
  projectName: 'tokio', // Usually your repo name.

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'content/tokio',
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: 'tokio',
          // Please change this to your repo.
          editUrl: 'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        theme: {
          customCss: [require.resolve('./src/css/style.scss')],
        },
      }),
    ],
  ],
  plugins: ['docusaurus-plugin-sass'],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '',
        logo: {
          alt: 'Tokio Logo',
          src: 'img/tokio-horizontal-dark.svg',
          srcDark: 'img/tokio-horizontal.svg',
          href: 'https://tokio.rs',
          target: '_self',
          width: 200,
          height: 200,
        },
        hideOnScroll: true,
        items: [
          {
            type: 'doc',
            docId: 'tutorial/index',
            position: 'right',
            label: 'Learn',
          },
          {
            href: 'https://docs.rs/tokio',
            label: 'API Docs',
            position: 'right',
          },
          { to: '/blog', label: 'Blog', position: 'right' },
          {
            href: 'https://github.com/facebook/docusaurus',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        logo: {
          alt: 'Tokio Runtime Logo',
          src: 'img/tokio-horizontal.svg',
          href: 'https://tokio.rs',
          width: 160,
          height: 51,
        },
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Get Help',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/rust-tokio',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/tokio',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/tokio_rs',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/tokio-rs',
              },
            ],
          },
          ...libs
        ],
        copyright: `Built with all the love in the world by @carllerch`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      colorMode: {
        respectPrefersColorScheme: true,
      },

    }),
};

module.exports = config;
