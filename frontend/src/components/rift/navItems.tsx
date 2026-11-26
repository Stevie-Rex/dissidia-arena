import type { ReactNode } from 'react'
import type { GameId } from '../../data/mock'
import { isAdmin, type Role } from '../../lib/api'
import type { NavKey } from './nav'
import { GiCrenulatedShield, GiCrossedSwords, GiLaurels, GiStoneTower, GiTrophy, GiVisoredHelm } from './icons'

type Glyph = (size: number) => ReactNode
export type NavItem = { key: NavKey; label: string; to: string; hint: string; glyph?: Glyph; children?: NavItem[] }

export function navItems(game: GameId, role: Role | undefined) {
  const items: NavItem[] = [
    { key: 'hub', label: 'Hub', to: `/${game}`, glyph: (s) => <GiStoneTower size={s} />, hint: 'Your game at a glance: the queue, your open match and the Season.' },
    { key: 'queue', label: 'Queue', to: '/queue', glyph: (s) => <GiCrossedSwords size={s} />, hint: 'Find a ranked 1v1 Bo3 opponent.' },
    { key: 'ladder', label: 'Ladder', to: `/${game}/ladder`, glyph: (s) => <GiLaurels size={s} />, hint: 'Where every player stands this Season.' },
    { key: 'profile', label: 'Profile', to: '/players/me', glyph: (s) => <GiVisoredHelm size={s} />, hint: 'Your matches, your record and your card.' },
    { key: 'rewards', label: 'Rewards', to: '/rewards', glyph: (s) => <GiTrophy size={s} />, hint: 'The unlocks your ranked wins earn.' },
  ]
  if (isAdmin(role))
    items.push({
      key: 'admin',
      label: 'Admin',
      to: '/admin',
      glyph: (s) => <GiCrenulatedShield size={s} />,
      hint: 'Cases, the Admin log and Admins. Only Admins see this.',
      children: [
        { key: 'cases', label: 'Cases', to: '/admin', hint: 'Disputed matches and Help requests waiting for an Admin.' },
        { key: 'log', label: 'Admin log', to: '/admin/log', hint: 'Every Admin action, newest first.' },
        ...(role === 'master' ? [{ key: 'admins' as const, label: 'Admins', to: '/master', hint: 'Appoint and remove Admins. Only the Master sees this.' }] : []),
      ],
    })
  return items
}
