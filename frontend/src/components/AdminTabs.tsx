import { Link, useLocation } from 'react-router-dom'

/** Switches between the Admin area's pages: cases (/admin and each case) and the Admin log. */
export default function AdminTabs() {
  const onLog = useLocation().pathname.startsWith('/admin/log')
  const tabs = [
    { to: '/admin', label: 'Cases', current: !onLog },
    { to: '/admin/log', label: 'Admin log', current: onLog },
  ]
  return (
    <nav aria-label="Admin area" className="flex gap-2">
      {tabs.map((t) => (
        <Link key={t.to} to={t.to} aria-current={t.current ? 'page' : undefined} className="da-pill rounded-full px-3 py-1 text-xs">
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
