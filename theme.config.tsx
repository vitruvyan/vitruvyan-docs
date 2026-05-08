import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'Inconsolata, monospace' }}>
      Vitruvyan OS
    </span>
  ),
  docsRepositoryBase: 'https://github.com/vitruvyan-team/vitruvyan-core-docs/tree/main',
  footer: {
    text: 'Copyright © 2026 Vitruvyan Team',
  },
  primaryHue: 210,
  sidebar: {
    defaultMenuCollapseLevel: 1,
    autoCollapse: true,
  },
  navigation: true,
  toc: {
    backToTop: true,
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Vitruvyan OS" />
      <meta property="og:description" content="Domain-agnostic epistemic operating system" />
    </>
  ),
  useNextSeoProps() {
    return {
      titleTemplate: '%s — Vitruvyan OS',
    }
  },
}

export default config
