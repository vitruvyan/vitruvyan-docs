'use client'

import dynamic from 'next/dynamic'
import styles from './chat.module.css'

const ReactMarkdown = dynamic(() => import('react-markdown').then(m => m.default), { ssr: false })
const MermaidBlock = dynamic(() => import('./MermaidBlock').then(m => m.MermaidBlock), { ssr: false })

interface Props {
  content: string
}

export function MarkdownMessage({ content }: Props) {
  return (
    <div className={styles.markdownBody}>
      <ReactMarkdown
        components={{
          // Custom code block: detect ```mermaid and render diagram
          code(props: any) {
            const { children, className } = props
            const lang = /language-(\w+)/.exec(className || '')?.[1]
            const code = String(children).replace(/\n$/, '')

            if (lang === 'mermaid') {
              return <MermaidBlock code={code} />
            }
            // Inline code or other languages
            return <code className={className}>{children}</code>
          },
          // Open external links in new tab
          a({ href, children }) {
            return (
              <a href={href} target={href?.startsWith('/') ? '_self' : '_blank'} rel="noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
