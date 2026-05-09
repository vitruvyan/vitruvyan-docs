import React from 'react'
import { useTheme } from 'nextra-theme-docs'
import { DocsThemeConfig } from 'nextra-theme-docs'

function Logo() {
  const { resolvedTheme } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <img
        src="/vit_logo_header.svg"
        alt="Vitruvyan"
        height={28}
        style={{
          height: 28,
          width: 'auto',
          filter: resolvedTheme === 'dark' ? 'invert(1) brightness(1.1)' : 'none',
          transition: 'filter 0.2s',
        }}
      />
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        opacity: 0.45,
        fontFamily: 'var(--font-inter, sans-serif)',
      }}>
        Knowledge Base
      </span>
    </div>
  )
}

const config: DocsThemeConfig = {
  logo: <Logo />,
  navbar: {
    extraContent: (
      <a
        href="/"
        style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          padding: '0.3rem 0.85rem',
          borderRadius: '999px',
          border: '1px solid rgba(109,40,217,0.35)',
          color: '#7c3aed',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
      >
        Ask AI
      </a>
    ),
  },
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
