module.exports = {
  mySidebar: [
    {
      type: 'category',
      label: 'Tokio',
      items: [
        {
          type: 'category',
          label: 'Tutorial',
          link: {
            type: 'doc',
            id: 'tutorial/index',
          },
          items: [
            'tutorial/hello-tokio',
            'tutorial/spawning',
            'tutorial/shared-state',
            'tutorial/channels',
            'tutorial/io',
            'tutorial/framing',
            'tutorial/async',
            'tutorial/select',
            'tutorial/streams'
          ]
        },
        {
          type: 'category',
          label: 'Topics',
          link: {
            type: 'doc',
            id: 'topics/index',
          },
          items: [
            'topics/bridging',
            'topics/shutdown',
          ]
        },
        'glossary'
      ],
    },
  ],
};
