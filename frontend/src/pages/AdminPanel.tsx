import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminTabs from '../components/AdminTabs'
import { Sub } from '../components/ui'
import { useApp } from '../state/AppState'
import type { CaseFilter, CaseFilterState } from './AdminCases'

/**
 * The Admin panel around its tabs and case pages: one header, and the case filter, which stays as picked
 * until the Admin leaves the panel. Each page inside gates itself by role.
 */
export default function AdminPanel() {
  const { user } = useApp()
  const [filter, setFilter] = useState<CaseFilter>('All')
  const context: CaseFilterState = { filter, setFilter }
  return (
    <div className="flex flex-col gap-4">
      {(user?.role === 'admin' || user?.role === 'master') && (
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-3">
          <div className="flex flex-col">
            <h1 className="m-0 text-2xl font-semibold">Admin panel</h1>
            <Sub className="break-words">
              {user.displayName} · {user.role === 'master' ? 'Master' : 'Admin'}
            </Sub>
          </div>
          <AdminTabs />
        </header>
      )}
      <Outlet context={context} />
    </div>
  )
}
