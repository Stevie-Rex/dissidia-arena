/** Which sidebar item a path belongs to. Exported for the phone bar (#45) and More page to share. */
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
  return undefined
}
