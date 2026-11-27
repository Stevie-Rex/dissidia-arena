import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppState'

/** The Admin panel's tabs: Cases (/admin and each case), Log, and Admins for the Master only. */
export default function AdminTabs() {
  const { pathname } = useLocation()
  const { user } = useApp()
  const onLog = pathname.startsWith('/admin/log')
  const onAdmins = pathname.startsWith('/admin/admins')
  const tabs = [
    { to: '/admin', label: 'Cases', current: !onLog && !onAdmins },
    { to: '/admin/log', label: 'Log', current: onLog },
    ...(user?.role === 'master' ? [{ to: '/admin/admins', label: 'Admins', current: onAdmins }] : []),
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
