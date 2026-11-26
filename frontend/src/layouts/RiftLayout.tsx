import { Fragment } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import LockPanel from '../components/appearance/LockPanel'
import ModeToggle from '../components/appearance/ModeToggle'
import { AuthErrorBanner, DisputeNotice, FriendsSidebar, GameSwitcher, MobileTabs, Overlays } from '../components/Layout'
import { Avatar, Btn, Logo, Pill } from '../components/ui'
import { OPEN_STATUSES, roleLinks } from '../lib/api'
import { cx } from '../lib/format'
import { useApp } from '../state/AppState'

function RiftHeader() {
  const { game, signedIn, startQueue, phase, live, requireSignIn, user } = useApp()
  const navigate = useNavigate()
  const links = [
    { to: '/queue', label: 'PLAY' },
    { to: `/${game}/meta`, label: 'FIGHTERS' },
    { to: `/${game}/ladder`, label: 'RANKINGS' },
    { to: '/rewards', label: 'REWARDS' },
    ...roleLinks(user?.role).map((l) => ({ ...l, label: l.label.toUpperCase() })),
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    cx('flex min-h-11 items-center px-3 no-underline underline-offset-8', isActive && 'underline decoration-gold decoration-1')
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[clamp(20px,4vw,56px)] py-2.5">
        <div className="flex items-center gap-4">
          <Logo />
          <GameSwitcher crests />
        </div>
        <nav aria-label="Main" className="hidden flex-wrap items-center font-heading text-sm font-semibold tracking-[0.1em] md:flex">
          {links.map((l, i) => (
            <Fragment key={l.to}>
              {i > 0 && (
                <span aria-hidden className="text-[8px] text-gold">
                  ◆
                </span>
              )}
              <NavLink to={l.to} className={link}>
                {l.label}
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <ModeToggle />
          <InterfaceSwitcher />
          {live && OPEN_STATUSES.includes(live.status) && (
            <Link to="/match/live">
              <Pill active className="hidden sm:inline-block">
                ● In match vs {live.opponent.displayName}
              </Pill>
            </Link>
          )}
          {phase === 'idle' && (
            <Btn main className="hidden sm:inline-flex" onClick={() => (signedIn ? navigate('/queue') : startQueue())}>
              Queue
            </Btn>
          )}
          {signedIn ? (
            <Link to="/players/me" aria-label="Your profile" className="flex min-h-11 items-center">
              <Avatar name={user?.displayName ?? 'You'} src={user?.avatarUrl} ring="you" size={30} />
            </Link>
          ) : (
            <Btn variant="ghost" onClick={() => requireSignIn('Sign in')}>
              Sign in
            </Btn>
          )}
        </div>
      </div>
    </header>
  )
}

function RiftFooter() {
  const { user } = useApp()
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line px-[clamp(20px,4vw,56px)] py-7 text-[13px] text-muted">
      <span>Dissidia Arena — a fan project</span>
      <nav aria-label="More" className="flex flex-wrap gap-4">
        <Link to="/tournaments" className="hover:text-fg">
          Tournaments
        </Link>
        <Link to="/party" className="hover:text-fg">
          Party
        </Link>
        <Link to="/friends" className="hover:text-fg xl:hidden">
          Friends
        </Link>
        <Link to="/discord" className="hover:text-fg">
          Discord bot
        </Link>
        {/* The header nav is hidden on small screens. */}
        {roleLinks(user?.role).map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-fg md:hidden">
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="font-heading font-semibold tracking-[0.1em]">INTERFACE: RIFT</span>
      <p className="m-0 w-full text-xs">
        Icons by Lorc and Delapouite from{' '}
        <a href="https://game-icons.net" className="underline underline-offset-2 hover:text-fg">
          game-icons.net
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" className="underline underline-offset-2 hover:text-fg">
          CC BY 3.0
        </a>
        .
      </p>
    </footer>
  )
}

/** The default interface, in Chaos mode (dark) or Cosmos mode (light), with a Cosmos side and a Chaos side. */
export default function RiftLayout() {
  const { signedIn } = useApp()
  const { pathname } = useLocation()
  // The home page runs edge to edge (the fracture hero); everything else sits in the content column.
  const fullBleed = pathname === '/'
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <RiftHeader />
      <LockPanel />
      <AuthErrorBanner />
      <DisputeNotice />
      {fullBleed ? (
        <main>
          <Outlet />
        </main>
      ) : (
        <div className="mx-auto flex max-w-7xl gap-6 px-[clamp(20px,4vw,56px)] pt-8">
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
          {signedIn && <FriendsSidebar />}
        </div>
      )}
      <RiftFooter />
      <MobileTabs />
      <Overlays />
    </div>
  )
}
