/** Which sidebar item a path belongs to. Shared by the sidebar and the phone bar. */
export function currentNavKey(pathname: string): string | undefined {
  if (/^\/(012|nt)$/.test(pathname)) return 'hub'
  if (/^\/(012|nt)\/ladder/.test(pathname)) return 'ladder'
  if (/^\/(queue|match\/)/.test(pathname)) return 'queue'
  if (/^\/players\/me(\/|$)/.test(pathname)) return 'profile'
  if (pathname.startsWith('/rewards')) return 'rewards'
  if (pathname.startsWith('/admin/log')) return 'log'
  if (pathname.startsWith('/admin')) return 'cases'
  if (pathname.startsWith('/master')) return 'admins'
  if (pathname.startsWith('/config')) return 'settings'
  if (pathname.startsWith('/credits')) return 'credits'
  if (pathname.startsWith('/more')) return 'more'
  return undefined
}

/** The phone bar's tile for a path. Pages that sit in More on a phone (Rewards, Settings, Admin, Credits) light More. */
export function currentTileKey(pathname: string): string | undefined {
  const key = currentNavKey(pathname)
  if (key === 'hub' || key === 'ladder' || key === 'queue' || key === 'profile') return key
  return key ? 'more' : undefined
}
