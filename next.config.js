const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
})

module.exports = withNextra({
  transpilePackages: [
    'react-markdown',
    'remark-gfm',
    'remark-parse',
    'unified',
    'vfile',
    'vfile-message',
    'unist-util-stringify-position',
    'bail',
    'is-plain-obj',
    'trough',
    'mdast-util-from-markdown',
    'mdast-util-to-string',
    'micromark',
  ],
})
