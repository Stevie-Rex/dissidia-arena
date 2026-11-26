import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import LockPanel from '../components/appearance/LockPanel'
import ModeToggle from '../components/appearance/ModeToggle'
import { AuthErrorBanner, DisputeNotice, GameSwitcher, MobileTabs, Overlays } from '../components/Layout'
import HelpStrip from '../components/rift/HelpStrip'
import { useHelpText } from '../components/rift/hints'
import Sidebar from '../components/rift/Sidebar'
import { Avatar, Btn, Logo, Pill } from '../components/ui'
import { OPEN_STATUSES, roleLinks } from '../lib/api'
import { useApp } from '../state/AppState'

/** Phones only, until the bottom bar (#45). Desktop has the sidebar. */
function RiftHeader() {
  const { signedIn, startQueue, phase, live, requireSignIn, user } = useApp()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur md:hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[clamp(20px,4vw,56px)] py-2.5">
        <div className="flex items-center gap-4">
          <Logo />
          <GameSwitcher crests />
        </div>
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

/** Links that aren't in the sidebar yet. The fan-project line and the icon credit sit in the sidebar foot on desktop. */
function RiftFooter() {
  const { user } = useApp()
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line px-[clamp(20px,4vw,56px)] py-7 text-[13px] text-muted">
      <span className="md:hidden">Dissidia Arena — a fan project</span>
      <nav aria-label="More" className="flex flex-wrap gap-4">
        <Link to="/tournaments" className="hover:text-fg">
          Tournaments
        </Link>
        <Link to="/party" className="hover:text-fg">
          Party
        </Link>
        <Link to="/friends" className="hover:text-fg">
          Friends
        </Link>
        <Link to="/discord" className="hover:text-fg">
          Discord bot
        </Link>
        {/* Phones have no sidebar yet, so the role links live here. */}
        {roleLinks(user?.role).map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-fg md:hidden">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="m-0 w-full text-xs md:hidden">
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

/**
 * The default interface, in Chaos mode (dark) or Cosmos mode (light). Desktop: the sidebar, then a column with the
 * page and the help strip. Phones: the header and the tab bar (until #45).
 */
export default function RiftLayout() {
  const { pathname } = useLocation()
  const help = useHelpText()
  // The home page runs edge to edge (the fracture hero); everything else sits in the content column.
  const fullBleed = pathname === '/'
  return (
    <div className="rift-shell" {...help.handlers}>
      <Sidebar className="hidden md:flex" />
      <div className="rift-column pb-20 md:pb-0">
        <RiftHeader />
        <LockPanel />
        <AuthErrorBanner />
        <DisputeNotice />
        {fullBleed ? (
          <main className="flex-1">
            <Outlet />
          </main>
        ) : (
          <main className="mx-auto w-full max-w-7xl flex-1 px-[clamp(20px,4vw,56px)] pt-8">
            <Outlet />
          </main>
        )}
        <RiftFooter />
        <HelpStrip text={help.text} className="hidden md:flex" />
      </div>
      <MobileTabs />
      <Overlays />
    </div>
  )
}
