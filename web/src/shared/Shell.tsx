import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api'

const links = [
  { to: '/today', label: 'Today', file: 'today.txt' },
  { to: '/inbox', label: 'Inbox', file: 'brief.md' },
  { to: '/matrix', label: 'Priorities', file: 'matrix' },
  { to: '/track', label: 'Focus', file: 'focus.exe' },
  { to: '/notes', label: 'Notes', file: 'notes' },
  { to: '/load', label: 'Load', file: 'analytics' },
  { to: '/settings', label: 'Sources', file: 'settings' },
]

function currentTheme(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function Shell() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('wb-theme', next)
    setTheme(next)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" width={40} height={40} />
          <div>
            <strong>Want Brief</strong>
            <span>ALL TASKS. ONE PLACE.</span>
          </div>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <small>{link.file}</small>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void api.logout().finally(() => navigate('/login'))
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="stage">
        <Outlet />
      </main>
    </div>
  )
}
