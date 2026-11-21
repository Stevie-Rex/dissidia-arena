import type { ReactNode } from 'react'
import type { Role } from '../lib/api'
import { useApp } from '../state/AppState'
import { Card } from './ui'

/** Shows its children only to the given roles. The server checks the role too; this just avoids a page of errors. */
export default function RoleGate({ allow, who, children }: { allow: Role[]; who: string; children: ReactNode }) {
  const { user } = useApp()
  if (user === undefined) return null
  if (!user || !allow.includes(user.role))
    return (
      <Card className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold">Not available</h1>
        <p className="m-0 text-sm text-muted">This page is only for {who}.</p>
      </Card>
    )
  return children
}
