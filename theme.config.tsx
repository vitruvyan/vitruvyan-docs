import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

function Logo() {
  // The same lockup as the Orbis UI (components/brand/BrandLogo.jsx): the two SVGs are
  // masks, so the colour follows the theme through currentColor.
  const mask = (url: string): React.CSSProperties => ({
    display: 'block',
    height: 26,
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span role="img" aria-label="Vitruvyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden="true" style={{ ...mask('/brand/symbol_vit.svg'), width: 25 }} />
        <span aria-hidden="true" style={{ ...mask('/brand/wordmark.svg'), width: 115 }} />
      </span>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        opacity: 0.45,
        fontFamily: 'var(--font-inter, sans-serif)',
      }}>
        <span className="kb-label-long">Knowledge Base</span>
        <span className="kb-label-short">KB</span>
      </span>
    </div>
  )
}

const config: DocsThemeConfig = {
  logo: <Logo />,
  navbar: {
    extraContent: (
      <a
        href="https://app.vitruvyan.com/discover"
        style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          padding: '0.3rem 0.85rem',
          borderRadius: '999px',
          border: '1px solid rgba(109,40,217,0.35)',
          background: 'rgba(109,40,217,0.06)',
          color: '#7c3aed',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
        <span className="kb-label-long">Ask Vitruvyan</span>
        <span className="kb-label-short">Ask Vit</span>
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
