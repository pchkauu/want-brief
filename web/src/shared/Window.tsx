import type { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
  actions?: ReactNode
}

export function Window({ title, children, actions }: Props) {
  return (
    <section className="window">
      <header className="titlebar">
        <span className="dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <h1>{title}</h1>
        <div className="title-actions">{actions}</div>
      </header>
      <div className="window-body">{children}</div>
    </section>
  )
}
