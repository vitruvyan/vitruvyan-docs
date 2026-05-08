const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
})

module.exports = withNextra({
  experimental: {
    outputFileTracingFollowSymlinks: true,
  },
  webpack: (config) => {
    // prevent webpack from resolving symlinks to their real path —
    // Nextra's page map is keyed by the pages/ path, not the real path
    config.resolve.symlinks = false
    return config
  },
})
