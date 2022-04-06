// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const behead = require('remark-behead');
const lightCodeTheme = require('prism-react-renderer/themes/github');
var darkCodeTheme = require('prism-react-renderer/themes/dracula');


darkCodeTheme.styles = darkCodeTheme.styles.filter(({ types, style }) => style.fontStyle !== "italic");

darkCodeTheme.styles.push(
  {
    types: ["keyword", "variable"],
    style: {
      color: "rgb(189, 147, 249)",
    }
  }
)


const handles = {
  github: "https://github.com/tokio-rs/tokio",
  twitter: "https://twitter.com/tokio_rs",
  discord: "https://discord.gg/tokio",
}

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
          beforeDefaultRemarkPlugins: [[behead, { depth: 1 }]],
          // Please change this to your repo.
          editUrl: 'https://github.com/tokio-rs/website/tree/master',
        },
        blog: {
          path: 'content/blog',
          showReadingTime: true,
          blogSidebarCount: 'ALL',
          postsPerPage: 1,
          // Please change this to your repo.
          editUrl:
            'https://github.com/tokio-rs/website/tree/master',
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
            href: handles.twitter,
            'aria-label': 'Twitter Handle',
            className: 'navbar-icon navbar-twitter-link',
            position: 'right',
          },
          {
            href: handles.github,
            'aria-label': 'Github repository',
            className: 'navbar-icon navbar-github-link',
            position: 'right',
          },
          {
            href: handles.discord,
            'aria-label': 'Discord Support',
            className: 'navbar-icon navbar-discord-link',
            position: 'right',
          }
        ],
        style: 'dark'
      },
      footer: {
        style: 'dark',
        logo: {
          alt: 'Tokio Runtime Logo',
          src: 'img/tokio-horizontal.svg',
          href: '/',
          width: 160,
          height: 51,
        },
        links: [
          // {
          //   title: 'Get Help',
          //   items: [
          //     {
          //       label: 'Stack Overflow',
          //       href: 'https://stackoverflow.com/questions/tagged/rust-tokio',
          //     },
          //     {
          //       label: 'Discord',
          //       href: 'https://discord.gg/tokio',
          //     },
          //     {
          //       label: 'Twitter',
          //       href: 'https://twitter.com/tokio_rs',
          //     },
          //   ],
          // },
          // {
          //   title: 'More',
          //   items: [
          //     {
          //       label: 'Blog',
          //       to: '/blog',
          //     },
          //     {
          //       label: 'GitHub',
          //       href: 'https://github.com/tokio-rs',
          //     },
          //   ],
          // },
          ...libs
        ],
        copyright: `<div>
                    Built with all the love in the world by <a href="https://twitter.com/carllerche" target="_blank" rel="noopener">@carllerche</a>
                    <br />
                    with the help of our <a href="https://github.com/tokio-rs/tokio/graphs/contributors" target="_blank" rel="noopener">our contributors</a>
                    </div>
                    Copyright &#169; ${new Date().getFullYear()} Tokio-rs`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: [
          'rust',
          'toml',
        ]
      },
      colorMode: {
        respectPrefersColorScheme: true,
      },

    }),
  customFields: {
    handles
  }
};

module.exports = config;
